"""Server-Sent Events hub (Task 1.6).

A single :class:`SseHub` instance owns every active SSE session for the
broker. Each session is a *room* with a list of subscriber queues; a
publish broadcasts to every queue in the room.

Design highlights
-----------------

* **Bounded per-subscriber queues** — slow consumers cannot block the
  publisher. When a queue is full the message is dropped for that one
  subscriber and a structured warning is emitted.
* **Heartbeat** — the SSE generator emits a ``: keepalive\\n\\n`` comment
  every ``sse_heartbeat_interval_s`` seconds so proxies / load balancers
  do not idle-close the TCP connection.
* **Per-session rate limiter** — sliding 1-second window enforced on
  every ``publish``. Excess raises :class:`SseRateLimitedError`, which
  the router maps to ``429 Too Many Requests``.
* **Reconnection** — re-subscribing with the same ``session_id`` simply
  joins the existing room; no replay buffer is provided (live stream
  semantics, matching the spec).
* **Idle reaping** — a background task evicts rooms with no
  subscribers and no publishes in ``sse_session_idle_timeout_s``
  seconds.

The hub is owned by ``app.state`` so a single instance is shared across
requests and torn down cleanly in the FastAPI lifespan.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import AsyncIterator, Deque, Dict, List, Optional

from app.config import Settings
from app.models.sse import SseEventName, SsePublishRequest


log = logging.getLogger("agentic.sse")


# Sentinel pushed onto a subscriber queue to signal "you've been disconnected".
_CLOSE = object()


class SseRateLimitedError(Exception):
    """Raised when a session exceeds ``sse_publish_rate_per_session``."""

    def __init__(self, session_id: str, *, current: int, limit: int) -> None:
        super().__init__(
            f"sse session '{session_id}' over rate limit "
            f"({current}/{limit} msg/s)"
        )
        self.session_id = session_id
        self.current = current
        self.limit = limit


@dataclass
class _Room:
    """Per-session shared state."""

    session_id: str
    subscribers: List[asyncio.Queue] = field(default_factory=list)
    publishes_window: Deque[float] = field(default_factory=deque)
    last_activity_ts: float = field(default_factory=time.monotonic)
    total_published: int = 0


# Public-facing record passed across the queue. We keep it small and
# JSON-serialisable so the SSE generator stays trivial.
@dataclass
class _Frame:
    event: SseEventName
    data: str  # already-encoded JSON payload
    id: Optional[str] = None


class SseHub:
    """Connection registry + pub/sub for SSE sessions."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rooms: Dict[str, _Room] = {}
        self._lock = asyncio.Lock()
        self._reaper_task: Optional[asyncio.Task] = None

    # --------------------------------------------------------- lifecycle ----
    async def start(self) -> None:
        """Launch the idle-session reaper. Idempotent."""
        if self._reaper_task is None or self._reaper_task.done():
            self._reaper_task = asyncio.create_task(
                self._reap_idle_loop(), name="sse-hub-reaper"
            )

    async def aclose(self) -> None:
        """Cancel the reaper and disconnect every subscriber."""
        if self._reaper_task is not None:
            self._reaper_task.cancel()
            try:
                await self._reaper_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
            self._reaper_task = None

        async with self._lock:
            rooms = list(self._rooms.values())
            self._rooms.clear()
        for room in rooms:
            for q in room.subscribers:
                self._safe_put(q, _CLOSE)

    # ----------------------------------------------------------- queries ----
    def session_count(self) -> int:
        return len(self._rooms)

    def subscriber_count(self, session_id: str) -> int:
        room = self._rooms.get(session_id)
        return len(room.subscribers) if room else 0

    # ----------------------------------------------------------- publish ----
    async def publish(
        self,
        session_id: str,
        request: SsePublishRequest,
    ) -> int:
        """Broadcast ``request`` to every subscriber of ``session_id``.

        Returns the number of subscribers that successfully received
        the frame (i.e. whose queue was not full). Raises
        :class:`SseRateLimitedError` when the per-session 1-second
        window is full.
        """
        import json

        room = await self._get_or_create_room(session_id)
        self._enforce_rate_limit(room)

        frame = _Frame(
            event=request.event,
            data=json.dumps(request.data, ensure_ascii=False),
            id=request.id,
        )
        delivered = 0
        for q in list(room.subscribers):
            try:
                q.put_nowait(frame)
                delivered += 1
            except asyncio.QueueFull:
                log.warning(
                    "sse_publish_dropped_slow_subscriber",
                    extra={
                        "session_id": session_id,
                        "event": request.event.value,
                    },
                )
        room.last_activity_ts = time.monotonic()
        room.total_published += 1

        log.info(
            "sse_publish_ok",
            extra={
                "session_id": session_id,
                "event": request.event.value,
                "subscribers": len(room.subscribers),
                "delivered_to": delivered,
            },
        )
        return delivered

    # --------------------------------------------------------- subscribe ----
    async def subscribe(
        self, session_id: str
    ) -> AsyncIterator[bytes]:
        """Async generator yielding wire-format SSE bytes for one client.

        The generator runs until the consumer disconnects (caught as
        ``GeneratorExit`` / ``CancelledError``) or the hub is closed.
        It interleaves real frames with periodic ``: keepalive`` comments
        so intermediate proxies do not idle-close the connection.
        """
        room = await self._get_or_create_room(session_id)
        queue: asyncio.Queue = asyncio.Queue(
            maxsize=self._settings.sse_subscriber_queue_size
        )
        room.subscribers.append(queue)
        room.last_activity_ts = time.monotonic()
        log.info(
            "sse_subscribe",
            extra={
                "session_id": session_id,
                "subscribers": len(room.subscribers),
            },
        )
        try:
            async for chunk in self._stream_frames(session_id, queue):
                yield chunk
        finally:
            await self._unsubscribe(session_id, queue)

    async def _stream_frames(
        self, session_id: str, queue: asyncio.Queue
    ) -> AsyncIterator[bytes]:
        # Initial comment kicks browsers / proxies into "stream mode" and
        # lets the test client see a non-empty first chunk immediately.
        yield b": connected\n\n"

        heartbeat = self._settings.sse_heartbeat_interval_s
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=heartbeat)
            except asyncio.TimeoutError:
                yield b": keepalive\n\n"
                continue
            if item is _CLOSE:
                return
            assert isinstance(item, _Frame)
            yield self._encode_frame(item)

    @staticmethod
    def _encode_frame(frame: _Frame) -> bytes:
        # Per the SSE spec, fields are separated by '\n' and the message
        # is terminated by an empty line ('\n\n').
        parts: List[str] = []
        if frame.id is not None:
            parts.append(f"id: {frame.id}")
        parts.append(f"event: {frame.event.value}")
        # data: must not contain raw newlines; split into multiple
        # data: lines if it does. Our payloads are JSON so we usually
        # emit a single line.
        for line in frame.data.splitlines() or [""]:
            parts.append(f"data: {line}")
        parts.append("")  # blank line terminator
        parts.append("")
        return ("\n".join(parts)).encode("utf-8")

    # ---------------------------------------------------------- internals ---
    async def _get_or_create_room(self, session_id: str) -> _Room:
        async with self._lock:
            room = self._rooms.get(session_id)
            if room is None:
                room = _Room(session_id=session_id)
                self._rooms[session_id] = room
            return room

    async def _unsubscribe(
        self, session_id: str, queue: asyncio.Queue
    ) -> None:
        async with self._lock:
            room = self._rooms.get(session_id)
            if room is None:
                return
            try:
                room.subscribers.remove(queue)
            except ValueError:
                pass
            log.info(
                "sse_unsubscribe",
                extra={
                    "session_id": session_id,
                    "subscribers": len(room.subscribers),
                },
            )
            room.last_activity_ts = time.monotonic()
            # Empty rooms are GC'd by the reaper; we keep them for the
            # idle-timeout window so a client can immediately reconnect.

    def _enforce_rate_limit(self, room: _Room) -> None:
        limit = self._settings.sse_publish_rate_per_session
        now = time.monotonic()
        window_start = now - 1.0
        w = room.publishes_window
        while w and w[0] < window_start:
            w.popleft()
        if len(w) >= limit:
            raise SseRateLimitedError(
                room.session_id, current=len(w), limit=limit
            )
        w.append(now)

    @staticmethod
    def _safe_put(q: asyncio.Queue, item) -> None:
        try:
            q.put_nowait(item)
        except asyncio.QueueFull:  # pragma: no cover
            pass

    async def _reap_idle_loop(self) -> None:
        interval = self._settings.sse_reaper_interval_s
        idle_max = self._settings.sse_session_idle_timeout_s
        try:
            while True:
                await asyncio.sleep(interval)
                now = time.monotonic()
                async with self._lock:
                    stale = [
                        sid
                        for sid, room in self._rooms.items()
                        if not room.subscribers
                        and (now - room.last_activity_ts) > idle_max
                    ]
                    for sid in stale:
                        del self._rooms[sid]
                if stale:
                    log.info(
                        "sse_reaper_evicted",
                        extra={"sessions": stale, "count": len(stale)},
                    )
        except asyncio.CancelledError:
            log.info("sse_reaper_cancelled")
            raise
