"""ASGI middleware that enforces X-User auth + per-user rate limiting.

Sits in front of every ``/api/*`` handler so individual routers can
trust ``request.state.user_id`` / ``request.state.tenant_id`` without
re-parsing the header. The 401/429 responses produced here are the
authoritative source for those status codes (Task 1.7 acceptance
criteria).
"""

from __future__ import annotations

import logging
from typing import Iterable, Optional

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.services.auth import (
    AuthService,
    InvalidUserHeader,
    RateLimitedError,
    SessionExpiredError,
)


log = logging.getLogger("agentic.auth_middleware")


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate X-User, track session, enforce rate limit."""

    def __init__(
        self,
        app,
        *,
        auth_service: AuthService,
        skip_paths: Iterable[str],
    ) -> None:
        super().__init__(app)
        self._auth = auth_service
        self._skip_paths = set(skip_paths)

    async def dispatch(self, request: Request, call_next) -> Response:
        if self._should_skip(request.url.path):
            return await call_next(request)

        raw = request.headers.get("X-User")
        try:
            user_id, tenant_id = self._auth.parse_user_header(raw)
        except InvalidUserHeader as exc:
            log.info(
                "auth_invalid_header",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "client": request.client.host if request.client else None,
                    "reason": str(exc),
                },
            )
            return JSONResponse(
                status_code=401, content={"detail": str(exc)}
            )

        try:
            await self._auth.touch_and_check(user_id, tenant_id)
        except SessionExpiredError as exc:
            log.info(
                "auth_session_expired_response",
                extra={"user_id": user_id, "path": request.url.path},
            )
            return JSONResponse(
                status_code=401, content={"detail": str(exc)}
            )
        except RateLimitedError as exc:
            log.warning(
                "auth_rate_limited",
                extra={
                    "user_id": exc.user_id,
                    "current": exc.current,
                    "limit": exc.limit,
                    "path": request.url.path,
                },
            )
            return JSONResponse(
                status_code=429,
                content={"detail": str(exc)},
                headers={"Retry-After": "1"},
            )

        # Stash sanitised identity for downstream dependencies.
        request.state.user_id = user_id
        request.state.tenant_id = tenant_id
        request.state.full_user = f"{user_id}@{tenant_id}" if tenant_id else user_id

        return await call_next(request)

    def _should_skip(self, path: str) -> bool:
        if path in self._skip_paths:
            return True
        # Allow /docs/* and /openapi.* even when not exact-matched.
        for skip in self._skip_paths:
            if skip.endswith("/") and path.startswith(skip):
                return True
        return False
