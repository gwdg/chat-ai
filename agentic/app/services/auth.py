"""User-identity validation, session tracking, and per-user rate limiting.

Implements the in-process pieces of Task 1.7. The Kong auth stack
already terminates OIDC and writes ``X-User: <user_id>@<tenant_id>``
into every inbound request; here we only have to:

* sanity-check the format,
* keep a 30-minute idle-timeout session record per user,
* enforce a per-user request rate-limit (10 req/s default).

Everything is in-process and async-safe so it slots into a single
FastAPI middleware without any external dependencies (Redis, etc.).
The state is owned by ``app.state`` so a single instance is shared
across requests and torn down cleanly in lifespan.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Optional, Tuple


log = logging.getLogger("agentic.auth")


# Allow letters, digits, dot, hyphen, underscore in both halves. Must
# contain exactly one '@'. Length capped to keep header parsing cheap.
USER_HEADER_RE = re.compile(
    r"^(?P<user>[A-Za-z0-9._-]{1,64})@(?P<tenant>[A-Za-z0-9._-]{1,64})$"
)


class InvalidUserHeader(Exception):
    """Malformed or missing X-User. Maps to HTTP 401."""


class SessionExpiredError(Exception):
    """Idle-timeout exceeded. Maps to HTTP 401."""


class RateLimitedError(Exception):
    """Per-user request rate limit exceeded. Maps to HTTP 429."""

    def __init__(self, user_id: str, *, current: int, limit: int) -> None:
        super().__init__(
            f"user '{user_id}' over rate limit ({current}/{limit} req/s)"
        )
        self.user_id = user_id
        self.current = current
        self.limit = limit


@dataclass
class _Session:
    user_id: str
    tenant_id: str
    last_seen: float = field(default_factory=time.monotonic)
    request_window: Deque[float] = field(default_factory=deque)


class AuthService:
    """Stateful registry for user sessions + sliding-window rate limit."""

    def __init__(
        self,
        *,
        validate_format: bool = True,
        session_ttl_s: float = 30 * 60,
        rate_per_user: int = 10,
        rate_window_s: float = 1.0,
    ) -> None:
        self._validate_format = validate_format
        self._session_ttl_s = session_ttl_s
        self._rate_per_user = rate_per_user
        self._rate_window_s = rate_window_s
        self._sessions: Dict[str, _Session] = {}
        self._lock = asyncio.Lock()

    # ----------------------------------------------------------- format ----
    def parse_user_header(self, raw: Optional[str]) -> Tuple[str, str]:
        """Validate and split the X-User header into ``(user_id, tenant_id)``.

        When ``validate_format`` is False (test backdoor) we still
        require a non-empty value but accept anything else; ``tenant_id``
        is then the substring after ``@`` (possibly empty).
        """
        if raw is None or not raw.strip():
            raise InvalidUserHeader("missing X-User header")
        value = raw.strip()
        m = USER_HEADER_RE.match(value)
        if m is None:
            if self._validate_format:
                raise InvalidUserHeader(
                    "X-User must match '<user>@<tenant>' "
                    "([A-Za-z0-9._-]{1,64} on each side)"
                )
            user_part, _, tenant_part = value.partition("@")
            return user_part or value, tenant_part
        return m.group("user"), m.group("tenant")

    # ---------------------------------------------------------- session ----
    async def touch_and_check(
        self, user_id: str, tenant_id: str
    ) -> _Session:
        """Update last-seen + enforce TTL + enforce rate limit.

        Raises one of the auth exceptions on failure; otherwise returns
        the live session record.
        """
        now = time.monotonic()
        async with self._lock:
            session = self._sessions.get(user_id)
            if session is None:
                session = _Session(user_id=user_id, tenant_id=tenant_id)
                self._sessions[user_id] = session
            else:
                if (now - session.last_seen) > self._session_ttl_s:
                    log.info(
                        "auth_session_expired",
                        extra={"user_id": user_id, "idle_s": now - session.last_seen},
                    )
                    # Clear the stale record and start a fresh one;
                    # an "expired" surface is a 401 to the caller.
                    self._sessions.pop(user_id, None)
                    raise SessionExpiredError(
                        f"session for '{user_id}' expired after "
                        f"{self._session_ttl_s:.0f}s of inactivity"
                    )
                # Keep the session alive.
                session.last_seen = now

            self._enforce_rate_limit(session, now)

        return session

    # ----------------------------------------------------------- queries ---
    def session_count(self) -> int:
        return len(self._sessions)

    def is_session_active(self, user_id: str) -> bool:
        s = self._sessions.get(user_id)
        if s is None:
            return False
        return (time.monotonic() - s.last_seen) <= self._session_ttl_s

    def reset(self) -> None:
        """Clear all state. Used by tests."""
        self._sessions.clear()

    # --------------------------------------------------------- internals ---
    def _enforce_rate_limit(self, session: _Session, now: float) -> None:
        window_start = now - self._rate_window_s
        w = session.request_window
        while w and w[0] < window_start:
            w.popleft()
        if len(w) >= self._rate_per_user:
            raise RateLimitedError(
                session.user_id, current=len(w), limit=self._rate_per_user
            )
        w.append(now)
