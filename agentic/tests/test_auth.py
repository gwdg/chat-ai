"""Tests for Task 1.7: User Authentication & Validation.

Covers four pieces:

1. ``AuthService`` unit tests (format, session TTL, rate limiting).
2. ``AuthMiddleware`` HTTP behaviour: 401 for malformed / missing
   X-User, 429 for rate-limit, 200 for the happy path.
3. Cross-user ownership: Bob cannot read or cancel Alice's job, and
   Bob cannot subscribe / publish to Alice's SSE session.
4. Session-TTL expiry surfaces as 401.
"""

from __future__ import annotations

import asyncio
import json
from typing import Dict

import httpx
import pytest
from fastapi.testclient import TestClient

from app.clients.slurm import SlurmClient
from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app
from app.models.sse import SseEventName, SsePublishRequest
from app.services.auth import (
    AuthService,
    InvalidUserHeader,
    RateLimitedError,
    SessionExpiredError,
)
from app.services.sse_hub import SseHub, SseOwnershipError


# =============================================================================
#  AuthService unit tests
# =============================================================================


def test_parse_user_header_accepts_valid_format():
    svc = AuthService(validate_format=True)
    assert svc.parse_user_header("alice@gwdg") == ("alice", "gwdg")
    assert svc.parse_user_header("john.doe@gwdg.de") == ("john.doe", "gwdg.de")
    assert svc.parse_user_header("user_42@tenant-x") == ("user_42", "tenant-x")


def test_parse_user_header_rejects_invalid_format():
    svc = AuthService(validate_format=True)
    for bad in (None, "", "   ", "alice", "@gwdg", "alice@", "alice@@gwdg",
                "a/b@gwdg", "alice@gw dg", "alice@" + "x" * 200):
        with pytest.raises(InvalidUserHeader):
            svc.parse_user_header(bad)


def test_parse_user_header_lax_mode_returns_partition_or_whole():
    svc = AuthService(validate_format=False)
    assert svc.parse_user_header("alice") == ("alice", "")
    assert svc.parse_user_header("alice@gwdg") == ("alice", "gwdg")


@pytest.mark.asyncio
async def test_session_touch_creates_then_renews():
    svc = AuthService(session_ttl_s=10, rate_per_user=100)
    s = await svc.touch_and_check("alice", "gwdg")
    assert s.user_id == "alice"
    assert svc.session_count() == 1
    assert svc.is_session_active("alice")
    s2 = await svc.touch_and_check("alice", "gwdg")
    assert s2 is s


@pytest.mark.asyncio
async def test_session_expires_after_ttl():
    svc = AuthService(session_ttl_s=0.05, rate_per_user=100)
    await svc.touch_and_check("alice", "gwdg")
    await asyncio.sleep(0.1)
    with pytest.raises(SessionExpiredError):
        await svc.touch_and_check("alice", "gwdg")
    # The next call after expiry should succeed (fresh session).
    await svc.touch_and_check("alice", "gwdg")


@pytest.mark.asyncio
async def test_rate_limit_per_user_raises_after_threshold():
    svc = AuthService(session_ttl_s=60, rate_per_user=3, rate_window_s=1.0)
    for _ in range(3):
        await svc.touch_and_check("alice", "gwdg")
    with pytest.raises(RateLimitedError) as ex:
        await svc.touch_and_check("alice", "gwdg")
    assert ex.value.user_id == "alice"
    assert ex.value.limit == 3


@pytest.mark.asyncio
async def test_rate_limit_window_recovers_after_one_second():
    svc = AuthService(session_ttl_s=60, rate_per_user=2, rate_window_s=0.2)
    for _ in range(2):
        await svc.touch_and_check("alice", "gwdg")
    with pytest.raises(RateLimitedError):
        await svc.touch_and_check("alice", "gwdg")
    await asyncio.sleep(0.25)
    await svc.touch_and_check("alice", "gwdg")


@pytest.mark.asyncio
async def test_rate_limits_are_per_user_not_global():
    svc = AuthService(session_ttl_s=60, rate_per_user=2, rate_window_s=1.0)
    for _ in range(2):
        await svc.touch_and_check("alice", "gwdg")
    # Bob should still be allowed despite Alice exhausting her bucket.
    await svc.touch_and_check("bob", "gwdg")
    await svc.touch_and_check("bob", "gwdg")


# =============================================================================
#  AuthMiddleware HTTP behaviour
# =============================================================================


def _auth(user: str = "alice@gwdg") -> Dict[str, str]:
    return {
        "Authorization": "Bearer test-token",
        "X-User": user,
        "Content-Type": "application/json",
    }


def _build_app(**overrides):
    cfg: Dict = dict(
        slurm_mock_mode=True,
        vault_mock_mode=True,
        slurm_status_poll_interval_s=10.0,
        slurm_cancel_grace_period_s=0.0,
    )
    cfg.update(overrides)
    settings = Settings(**cfg)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return app, settings


def test_health_is_publicly_accessible():
    app, _ = _build_app()
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200


def test_missing_x_user_returns_401_with_detail():
    app, _ = _build_app()
    with TestClient(app) as c:
        r = c.get("/api/secrets/search_api_key")
    assert r.status_code == 401
    assert "X-User" in r.json()["detail"]


def test_malformed_x_user_returns_401():
    app, _ = _build_app()
    with TestClient(app) as c:
        # Missing tenant
        r = c.get("/api/secrets/search_api_key", headers={"X-User": "alice"})
    assert r.status_code == 401
    # And dangerous characters
    with TestClient(app) as c:
        r = c.get(
            "/api/secrets/search_api_key", headers={"X-User": "alice/../bob@gwdg"}
        )
    assert r.status_code == 401


def test_valid_x_user_passes_middleware():
    app, _ = _build_app()
    with TestClient(app) as c:
        r = c.get("/api/secrets/search_api_key", headers=_auth())
    assert r.status_code == 200


def test_per_user_rate_limit_returns_429():
    """All endpoints share the same per-user request budget."""
    app, _ = _build_app(auth_rate_per_user=3, auth_rate_window_s=1.0)
    with TestClient(app) as c:
        for _ in range(3):
            assert c.get("/api/secrets/search_api_key", headers=_auth()).status_code == 200
        r = c.get("/api/secrets/search_api_key", headers=_auth())
    assert r.status_code == 429
    assert r.headers.get("retry-after") == "1"
    assert "rate" in r.json()["detail"].lower()


def test_per_user_rate_limit_window_recovers():
    app, _ = _build_app(auth_rate_per_user=2, auth_rate_window_s=0.2)
    with TestClient(app) as c:
        for _ in range(2):
            assert c.get("/api/secrets/search_api_key", headers=_auth()).status_code == 200
        assert c.get("/api/secrets/search_api_key", headers=_auth()).status_code == 429
        import time as _t

        _t.sleep(0.25)
        assert c.get("/api/secrets/search_api_key", headers=_auth()).status_code == 200


def test_session_ttl_expiry_returns_401():
    app, _ = _build_app(auth_session_ttl_s=0.05, auth_rate_per_user=100)
    with TestClient(app) as c:
        assert c.get("/api/secrets/search_api_key", headers=_auth()).status_code == 200
        import time as _t

        _t.sleep(0.1)
        r = c.get("/api/secrets/search_api_key", headers=_auth())
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_rate_limits_are_isolated_between_users():
    app, _ = _build_app(auth_rate_per_user=2, auth_rate_window_s=1.0)
    with TestClient(app) as c:
        for _ in range(2):
            assert c.get("/api/secrets/search_api_key", headers=_auth("alice@gwdg")).status_code == 200
        assert c.get("/api/secrets/search_api_key", headers=_auth("alice@gwdg")).status_code == 429
        # Bob still has his full budget.
        assert c.get("/api/secrets/search_api_key", headers=_auth("bob@gwdg")).status_code == 200


def test_middleware_can_be_disabled_for_unit_tests():
    app, _ = _build_app(auth_middleware_enabled=False)
    # No X-User at all -> still 401 because get_user_id falls back to header
    # parsing, but the response now comes from the dependency, not the
    # middleware.
    with TestClient(app) as c:
        r = c.get("/api/secrets/search_api_key")
    assert r.status_code == 401


# =============================================================================
#  Cross-user ownership for SSE
# =============================================================================


def _build_sse_app(**overrides):
    cfg: Dict = dict(
        sse_publish_rate_per_session=100,
        auth_rate_per_user=100,
    )
    cfg.update(overrides)
    settings = Settings(**cfg)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return app


def test_sse_cross_user_publish_returns_403():
    """Bob cannot publish to a session that Alice has been creating."""
    app = _build_sse_app()
    with TestClient(app) as c:
        # Alice creates the room by publishing first.
        r = c.post(
            "/api/sse/sess-private/events",
            json={"event": "action", "data": {}},
            headers=_auth("alice@gwdg"),
        )
        assert r.status_code == 200
        # Bob's publish must be refused.
        r = c.post(
            "/api/sse/sess-private/events",
            json={"event": "action", "data": {}},
            headers=_auth("bob@gwdg"),
        )
        assert r.status_code == 403


def test_sse_cross_user_subscribe_returns_403():
    """Bob cannot subscribe to Alice's existing session."""
    app = _build_sse_app()
    with TestClient(app) as c:
        # Alice creates the room (publish is the cheap way).
        r = c.post(
            "/api/sse/sess-locked/events",
            json={"event": "action", "data": {}},
            headers=_auth("alice@gwdg"),
        )
        assert r.status_code == 200
        # Bob attempts to subscribe; ownership check rejects synchronously.
        r = c.get("/api/sse/sess-locked", headers=_auth("bob@gwdg"))
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_sse_hub_owner_first_touch_wins():
    settings = Settings(sse_publish_rate_per_session=10)
    hub = SseHub(settings)
    await hub.publish(
        "abc",
        SsePublishRequest(event=SseEventName.ACTION, data={}),
        user_id="alice@gwdg",
    )
    assert hub.session_owner("abc") == "alice@gwdg"
    with pytest.raises(SseOwnershipError):
        await hub.publish(
            "abc",
            SsePublishRequest(event=SseEventName.ACTION, data={}),
            user_id="bob@gwdg",
        )
    await hub.aclose()


# =============================================================================
#  Cross-user ownership for jobs (status + cancel)
# =============================================================================


def _build_jobs_app_keepalive():
    settings = Settings(
        slurm_mock_mode=True,
        slurm_status_poll_interval_s=10.0,
        slurm_status_cache_ttl_s=10.0,
        slurm_cancel_grace_period_s=0.0,
        auth_rate_per_user=100,
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return app


def test_status_cross_user_returns_403():
    """Bob cannot read a job submitted by Alice."""
    app = _build_jobs_app_keepalive()
    with TestClient(app) as client:
        r = client.post(
            "/api/jobs",
            content=json.dumps(
                {"session_id": "sx", "container_image": "/i.sif"}
            ),
            headers=_auth("alice@gwdg"),
        )
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]

        r = client.get(
            f"/api/jobs/{job_id}/status", headers=_auth("bob@gwdg")
        )
        assert r.status_code == 403, r.text

        # And Alice can still read her own job.
        r = client.get(
            f"/api/jobs/{job_id}/status", headers=_auth("alice@gwdg")
        )
        assert r.status_code == 200, r.text


def test_cancel_cross_user_still_returns_403_under_middleware():
    """Sanity: the 1.4 cancel-ownership 403 isn't masked by the new
    auth middleware (e.g. by swapping it for 401)."""
    app = _build_jobs_app_keepalive()
    with TestClient(app) as client:
        r = client.post(
            "/api/jobs",
            content=json.dumps(
                {"session_id": "sx2", "container_image": "/i.sif"}
            ),
            headers=_auth("alice@gwdg"),
        )
        assert r.status_code == 200
        job_id = r.json()["job_id"]
        r = client.delete(f"/api/jobs/{job_id}", headers=_auth("bob@gwdg"))
    assert r.status_code == 403
