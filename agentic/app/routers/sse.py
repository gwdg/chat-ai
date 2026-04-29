"""Server-Sent Events streaming endpoints (Task 1.6).

Two endpoints make up the SSE surface:

* ``GET  /api/sse/{session_id}``         — long-lived subscription
* ``POST /api/sse/{session_id}/events``  — one-shot publish (used by
  the agent runtime running inside the Apptainer container)

The agent inside the Slurm job pushes structured ``action`` / ``result``
/ ``error`` events to the broker via POST; every browser tab subscribed
to the same ``session_id`` receives them in real time.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.dependencies import get_sse_hub, get_user_id
from app.models.sse import SsePublishRequest, SsePublishResponse
from app.services.sse_hub import (
    SseHub,
    SseOwnershipError,
    SseRateLimitedError,
)


log = logging.getLogger("agentic.sse_router")

router = APIRouter(prefix="/api/sse", tags=["sse"])


SSE_HEADERS = {
    # Disable nginx-style buffering so events flush immediately.
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@router.get(
    "/{session_id}",
    responses={
        200: {
            "content": {"text/event-stream": {}},
            "description": "Open SSE stream for the session",
        },
        401: {"description": "Authentication failed"},
        403: {"description": "Caller does not own this session"},
    },
)
async def subscribe(
    session_id: str,
    user_id: str = Depends(get_user_id),
    hub: SseHub = Depends(get_sse_hub),
) -> StreamingResponse:
    log.info(
        "sse_subscribe_received",
        extra={"session_id": session_id, "user_id": user_id},
    )
    # Eagerly create / validate the room ownership so we can return 403
    # before opening the streaming response (StreamingResponse does not
    # let us change the status code mid-stream).
    try:
        await hub.touch_room(session_id, user_id=user_id)
    except SseOwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    generator = hub.subscribe(session_id, user_id=user_id)
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post(
    "/{session_id}/events",
    response_model=SsePublishResponse,
    responses={
        401: {"description": "Authentication failed"},
        422: {"description": "Invalid event payload"},
        429: {"description": "Per-session rate limit exceeded"},
    },
)
async def publish(
    session_id: str,
    body: SsePublishRequest,
    user_id: str = Depends(get_user_id),
    hub: SseHub = Depends(get_sse_hub),
) -> SsePublishResponse:
    log.info(
        "sse_publish_received",
        extra={
            "session_id": session_id,
            "user_id": user_id,
            "event": body.event.value,
        },
    )
    try:
        delivered = await hub.publish(session_id, body, user_id=user_id)
    except SseOwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except SseRateLimitedError as exc:
        log.warning(
            "sse_publish_rate_limited",
            extra={
                "session_id": session_id,
                "user_id": user_id,
                "current": exc.current,
                "limit": exc.limit,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": "1"},
        ) from exc

    return SsePublishResponse(session_id=session_id, delivered_to=delivered)
