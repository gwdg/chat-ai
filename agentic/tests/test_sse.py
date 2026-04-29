"""Tests for Task 1.6: Server-Sent Events streaming.

The HTTP layer is tested via FastAPI TestClient for behaviour that does
NOT require live streaming (headers, auth, validation, rate limit).
The streaming generator itself is exercised at the SseHub level so we
don't depend on httpx's ASGITransport (which buffers full responses in
0.27.x and would deadlock a long-lived SSE stream).
"""

from __future__ import annotations

import asyncio
import json
from typing import Dict, List

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app
from app.models.sse import SseEventName, SsePublishRequest
from app.services.sse_hub import SseHub, SseRateLimitedError


# ----------------------------------------------------------- helpers --------


def _make_app(**overrides):
    cfg: Dict = dict(
        sse_heartbeat_interval_s=10.0,
        sse_subscriber_queue_size=64,
        sse_publish_rate_per_session=100,
        sse_session_idle_timeout_s=300.0,
        sse_reaper_interval_s=60.0,
    )
    cfg.update(overrides)
    settings = Settings(**cfg)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return app, settings


def _auth(user: str = "alice@gwdg") -> Dict[str, str]:
    return {"Authorization": "Bearer test", "X-User": user}


# =============================================================================
#  HTTP-level tests (no streaming consumption — TestClient cannot stream
#  via ASGITransport in httpx 0.27 without buffering the whole response).
# =============================================================================


def test_publish_returns_200_for_known_event_types():
    app, _ = _make_app()
    with TestClient(app) as c:
        for kind in ("action", "result", "error", "message"):
            r = c.post(
                f"/api/sse/sess-pub/events",
                json={"event": kind, "data": {"k": "v"}},
                headers=_auth(),
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["session_id"] == "sess-pub"
            assert body["delivered_to"] == 0  # no subscribers attached
            assert body["queued"] is True


def test_publish_invalid_event_returns_422():
    app, _ = _make_app()
    with TestClient(app) as c:
        r = c.post(
            "/api/sse/sess-bad/events",
            json={"event": "not_a_real_event", "data": {}},
            headers=_auth(),
        )
        assert r.status_code == 422


def test_publish_requires_x_user():
    app, _ = _make_app()
    with TestClient(app) as c:
        r = c.post(
            "/api/sse/sess-no-auth/events",
            json={"event": "action", "data": {}},
        )
        assert r.status_code == 401


def test_subscribe_requires_x_user():
    """Subscription must reject the request before opening the stream."""
    app, _ = _make_app()
    with TestClient(app) as c:
        r = c.get("/api/sse/sess-no-auth")
        assert r.status_code == 401


def test_publish_rate_limit_returns_429_with_retry_after():
    app, _ = _make_app(sse_publish_rate_per_session=3)
    with TestClient(app) as c:
        for _ in range(3):
            r = c.post(
                "/api/sse/sess-rl/events",
                json={"event": "action", "data": {}},
                headers=_auth(),
            )
            assert r.status_code == 200
        r = c.post(
            "/api/sse/sess-rl/events",
            json={"event": "action", "data": {}},
            headers=_auth(),
        )
        assert r.status_code == 429
        assert r.headers.get("retry-after") == "1"


def test_publish_rate_limit_window_recovers_after_one_second():
    app, _ = _make_app(sse_publish_rate_per_session=2)
    with TestClient(app) as c:
        for _ in range(2):
            assert (
                c.post(
                    "/api/sse/sess-rl2/events",
                    json={"event": "action", "data": {}},
                    headers=_auth(),
                ).status_code
                == 200
            )
        assert (
            c.post(
                "/api/sse/sess-rl2/events",
                json={"event": "action", "data": {}},
                headers=_auth(),
            ).status_code
            == 429
        )
        # Sliding window of 1.0s; 1.05s of real time evicts both entries.
        import time as _t

        _t.sleep(1.05)
        assert (
            c.post(
                "/api/sse/sess-rl2/events",
                json={"event": "action", "data": {}},
                headers=_auth(),
            ).status_code
            == 200
        )


# =============================================================================
#  Direct SseHub tests (streaming + connection registry semantics).
# =============================================================================


@pytest.mark.asyncio
async def test_hub_subscribe_emits_connect_comment_first():
    settings = Settings(
        sse_heartbeat_interval_s=60.0,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)
    gen = hub.subscribe("s")
    first = await asyncio.wait_for(gen.__anext__(), timeout=1.0)
    assert first == b": connected\n\n"
    await gen.aclose()
    await hub.aclose()


@pytest.mark.asyncio
async def test_hub_publish_action_event_received_by_subscriber():
    settings = Settings(
        sse_heartbeat_interval_s=60.0,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)

    received: List[bytes] = []

    async def consume() -> None:
        async for chunk in hub.subscribe("sess1"):
            received.append(chunk)
            if len(received) >= 2:  # connect + first frame
                return

    consumer = asyncio.create_task(consume())
    # Wait for the subscription to register on the hub.
    for _ in range(50):
        if hub.subscriber_count("sess1") == 1:
            break
        await asyncio.sleep(0.01)
    assert hub.subscriber_count("sess1") == 1

    delivered = await hub.publish(
        "sess1",
        SsePublishRequest(
            event=SseEventName.ACTION,
            data={"type": "web_search", "message": "Searching..."},
            id="evt-1",
        ),
    )
    assert delivered == 1
    await asyncio.wait_for(consumer, timeout=1.0)
    await hub.aclose()

    assert received[0] == b": connected\n\n"
    frame = received[1].decode("utf-8")
    assert "id: evt-1" in frame
    assert "event: action" in frame
    # JSON payload on a single line.
    data_line = next(line for line in frame.splitlines() if line.startswith("data:"))
    payload = json.loads(data_line[len("data: ") :])
    assert payload == {"type": "web_search", "message": "Searching..."}
    # Frame must end with the SSE message terminator (blank line).
    assert frame.endswith("\n\n")


@pytest.mark.asyncio
async def test_hub_supports_result_and_error_events():
    settings = Settings(
        sse_heartbeat_interval_s=60.0,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)
    received: List[bytes] = []

    async def consume() -> None:
        async for chunk in hub.subscribe("multi"):
            received.append(chunk)
            if len(received) >= 3:  # connect + 2 events
                return

    consumer = asyncio.create_task(consume())
    for _ in range(50):
        if hub.subscriber_count("multi") == 1:
            break
        await asyncio.sleep(0.01)
    await hub.publish(
        "multi",
        SsePublishRequest(event=SseEventName.RESULT, data={"output": "hi"}),
    )
    await hub.publish(
        "multi",
        SsePublishRequest(
            event=SseEventName.ERROR, data={"code": "BOOM", "message": "x"}
        ),
    )
    await asyncio.wait_for(consumer, timeout=1.0)
    await hub.aclose()

    body = b"".join(received).decode("utf-8")
    assert "event: result" in body
    assert "event: error" in body


@pytest.mark.asyncio
async def test_hub_broadcasts_to_multiple_subscribers_for_same_session():
    settings = Settings(
        sse_heartbeat_interval_s=60.0,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)
    received_a: List[bytes] = []
    received_b: List[bytes] = []

    async def consume(buf: List[bytes], session: str) -> None:
        async for chunk in hub.subscribe(session):
            buf.append(chunk)
            if len(buf) >= 2:
                return

    a = asyncio.create_task(consume(received_a, "fanout"))
    b = asyncio.create_task(consume(received_b, "fanout"))
    for _ in range(50):
        if hub.subscriber_count("fanout") == 2:
            break
        await asyncio.sleep(0.01)
    assert hub.subscriber_count("fanout") == 2

    delivered = await hub.publish(
        "fanout",
        SsePublishRequest(event=SseEventName.ACTION, data={"k": "v"}),
    )
    assert delivered == 2
    await asyncio.wait_for(a, timeout=1.0)
    await asyncio.wait_for(b, timeout=1.0)
    await hub.aclose()

    assert b"event: action" in received_a[1]
    assert b"event: action" in received_b[1]


@pytest.mark.asyncio
async def test_hub_reconnect_to_same_session_resumes_streaming():
    settings = Settings(
        sse_heartbeat_interval_s=60.0,
        sse_publish_rate_per_session=10,
        sse_session_idle_timeout_s=600.0,
    )
    hub = SseHub(settings)

    # First subscriber connects then disconnects.
    gen1 = hub.subscribe("resume")
    await asyncio.wait_for(gen1.__anext__(), timeout=1.0)
    await gen1.aclose()
    assert hub.subscriber_count("resume") == 0

    # Second subscriber rejoins the same session — and receives new events.
    received: List[bytes] = []

    async def consume() -> None:
        async for chunk in hub.subscribe("resume"):
            received.append(chunk)
            if len(received) >= 2:
                return

    consumer = asyncio.create_task(consume())
    for _ in range(50):
        if hub.subscriber_count("resume") == 1:
            break
        await asyncio.sleep(0.01)

    await hub.publish(
        "resume",
        SsePublishRequest(event=SseEventName.ACTION, data={"resumed": True}),
    )
    await asyncio.wait_for(consumer, timeout=1.0)
    await hub.aclose()

    assert b"event: action" in received[1]


@pytest.mark.asyncio
async def test_hub_emits_keepalive_when_no_events_for_heartbeat_interval():
    settings = Settings(
        sse_heartbeat_interval_s=0.05,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)
    received: List[bytes] = []

    async def consume() -> None:
        async for chunk in hub.subscribe("hb"):
            received.append(chunk)
            if len(received) >= 2:
                return

    consumer = asyncio.create_task(consume())
    await asyncio.wait_for(consumer, timeout=1.0)
    await hub.aclose()

    assert received[0] == b": connected\n\n"
    assert received[1] == b": keepalive\n\n"


@pytest.mark.asyncio
async def test_hub_publish_to_session_with_no_subscribers_returns_zero():
    settings = Settings(sse_publish_rate_per_session=10)
    hub = SseHub(settings)
    delivered = await hub.publish(
        "lonely",
        SsePublishRequest(event=SseEventName.ACTION, data={"x": 1}),
    )
    assert delivered == 0
    await hub.aclose()


@pytest.mark.asyncio
async def test_hub_rate_limit_raises_after_threshold():
    settings = Settings(sse_publish_rate_per_session=2)
    hub = SseHub(settings)
    for _ in range(2):
        await hub.publish(
            "rl",
            SsePublishRequest(event=SseEventName.MESSAGE, data={}),
        )
    with pytest.raises(SseRateLimitedError) as ex:
        await hub.publish(
            "rl",
            SsePublishRequest(event=SseEventName.MESSAGE, data={}),
        )
    assert ex.value.session_id == "rl"
    assert ex.value.limit == 2
    await hub.aclose()


@pytest.mark.asyncio
async def test_hub_idle_reaper_evicts_empty_rooms():
    settings = Settings(
        sse_session_idle_timeout_s=0.1,
        sse_reaper_interval_s=0.05,
        sse_publish_rate_per_session=10,
    )
    hub = SseHub(settings)
    await hub.start()
    await hub.publish(
        "doomed",
        SsePublishRequest(event=SseEventName.MESSAGE, data={}),
    )
    assert hub.session_count() == 1
    for _ in range(40):
        await asyncio.sleep(0.05)
        if hub.session_count() == 0:
            break
    assert hub.session_count() == 0
    await hub.aclose()


@pytest.mark.asyncio
async def test_hub_subscriber_disconnect_cleans_registry():
    settings = Settings(sse_publish_rate_per_session=10)
    hub = SseHub(settings)
    gen = hub.subscribe("disc")
    await asyncio.wait_for(gen.__anext__(), timeout=1.0)
    assert hub.subscriber_count("disc") == 1
    await gen.aclose()
    assert hub.subscriber_count("disc") == 0
    await hub.aclose()


@pytest.mark.asyncio
async def test_hub_drops_messages_for_slow_subscriber_without_blocking_publisher():
    """A subscriber whose queue is full must not back-pressure the publisher.

    We use a tiny queue (size 2) and never drain it; the publisher must
    still complete and the hub must log structured drops rather than
    raising.
    """
    settings = Settings(
        sse_subscriber_queue_size=2,
        sse_publish_rate_per_session=100,
        sse_heartbeat_interval_s=60.0,
    )
    hub = SseHub(settings)

    slow_gen = hub.subscribe("slow")
    # Advance once so the queue is registered on the room.
    await asyncio.wait_for(slow_gen.__anext__(), timeout=1.0)
    assert hub.subscriber_count("slow") == 1

    # Three publishes onto a 2-slot queue: first two succeed, third drops.
    deliveries = []
    for i in range(3):
        deliveries.append(
            await hub.publish(
                "slow",
                SsePublishRequest(event=SseEventName.ACTION, data={"i": i}),
            )
        )

    await slow_gen.aclose()
    await hub.aclose()

    assert deliveries == [1, 1, 0], deliveries
