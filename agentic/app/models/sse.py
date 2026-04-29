"""Pydantic models for the Server-Sent Events stream (Task 1.6)."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SseEventName(str, Enum):
    """SSE event: field. Matches the FR-006 / Task 1.6 taxonomy."""

    ACTION = "action"
    RESULT = "result"
    ERROR = "error"
    MESSAGE = "message"


class SsePublishRequest(BaseModel):
    """Body of POST /api/sse/{session_id}/events.

    The agent runtime running inside the Apptainer container on the
    cluster calls this endpoint to push tool actions, results, and
    errors back through the broker to the user's browser.
    """

    event: SseEventName = SseEventName.MESSAGE
    data: Dict[str, Any] = Field(default_factory=dict)
    id: Optional[str] = Field(
        default=None,
        description="Optional SSE id field; clients use it for "
        "Last-Event-ID reconnection bookkeeping.",
    )


class SsePublishResponse(BaseModel):
    session_id: str
    delivered_to: int
    queued: bool = True
