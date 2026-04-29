"""Tests for Task 1.4: Slurm job cancellation."""

from __future__ import annotations

import json
import time
from typing import Callable, Dict

import httpx
from fastapi.testclient import TestClient

from app.clients.slurm import SlurmClient
from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app


def _build_app(handler: Callable[[httpx.Request], httpx.Response], **overrides):
    cfg: Dict = dict(
        slurm_base_url="http://slurm.test",
        slurm_max_retries=0,
        slurm_retry_backoff_s=0.0,
        slurm_status_poll_interval_s=10.0,
        slurm_status_cache_ttl_s=10.0,
        slurm_cancel_grace_period_s=0.0,
    )
    cfg.update(overrides)
    settings = Settings(**cfg)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(
        transport=transport, base_url=settings.slurm_base_url
    )
    app.state.slurm_client = SlurmClient(settings, http_client=http_client)
    return app


def _auth(user: str = "alice") -> Dict[str, str]:
    return {
        "Authorization": "Bearer test-token",
        "X-User": user,
        "Content-Type": "application/json",
    }


def _submit(client: TestClient, headers=None) -> str:
    resp = client.post(
        "/api/jobs",
        content=json.dumps({"session_id": "s", "container_image": "/i.sif"}),
        headers=headers or _auth(),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["job_id"]


# ----------------------------------------------------------- happy & errors --

def test_cancel_returns_200_and_records_reason():
    calls = {"submit": 0, "delete": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST" and req.url.path.endswith("/job/submit"):
            calls["submit"] += 1
            return httpx.Response(200, json={"job_id": 4242})
        if req.method == "DELETE":
            calls["delete"] += 1
            assert req.url.path.endswith("/job/4242")
            assert req.headers.get("authorization") == "Bearer test-token"
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"jobs": [{"job_id": 4242,
                                                       "job_state": ["RUNNING"]}]})

    app = _build_app(handler)
    with TestClient(app) as client:
        job_id = _submit(client)
        resp = client.delete(
            f"/api/jobs/{job_id}?reason=user_stop", headers=_auth()
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {
        "job_id": "4242",
        "status": "cancelled",
        "reason": "user_stop",
    }
    assert calls["delete"] == 1


def test_cancel_with_alternative_reason():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST" and req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 1})
        if req.method == "DELETE":
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"jobs": [{"job_id": 1,
                                                       "job_state": ["RUNNING"]}]})

    app = _build_app(handler)
    with TestClient(app) as client:
        _submit(client)
        resp = client.delete("/api/jobs/1?reason=session_end", headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["reason"] == "session_end"


def test_cancel_invalid_reason_returns_422():
    app = _build_app(lambda r: httpx.Response(200, json={"job_id": 1}))
    with TestClient(app) as client:
        _submit(client)
        resp = client.delete("/api/jobs/1?reason=not_a_reason", headers=_auth())
    assert resp.status_code == 422


def test_cancel_forbidden_when_user_not_owner():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            return httpx.Response(200, json={"job_id": 7})
        if req.method == "DELETE":
            raise AssertionError("Slurm DELETE should not be reached on 403")
        return httpx.Response(200, json={"jobs": [{"job_id": 7,
                                                       "job_state": ["RUNNING"]}]})

    app = _build_app(handler)
    with TestClient(app) as client:
        # Alice owns the job.
        _submit(client, headers=_auth("alice"))
        # Bob attempts to cancel.
        resp = client.delete("/api/jobs/7", headers=_auth("bob"))
    assert resp.status_code == 403


def test_cancel_unknown_job_returns_404():
    def handler(req: httpx.Request) -> httpx.Response:
        # Not tracked → router falls through to one-shot scancel.
        assert req.method == "DELETE"
        return httpx.Response(404, json={"errors": ["no such job"]})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.delete("/api/jobs/9999", headers=_auth())
    assert resp.status_code == 404


def test_cancel_409_when_job_already_terminal():
    """If the cached/last-known status is terminal we return 409."""

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            return httpx.Response(200, json={"job_id": 5})
        if req.method == "GET":
            return httpx.Response(
                200,
                json={
                    "jobs": [
                        {
                            "job_id": 5,
                            "job_state": ["COMPLETED"],
                            "exit_code": {
                                "return_code": {"set": True, "number": 0}
                            },
                            "end_time": {"set": True, "number": 1714000000},
                        }
                    ]
                },
            )
        if req.method == "DELETE":
            raise AssertionError("DELETE must not run when already terminal")
        return httpx.Response(404)

    app = _build_app(handler)
    with TestClient(app) as client:
        _submit(client)
        # Fetch status to populate the cache with a terminal state.
        s = client.get("/api/jobs/5/status", headers=_auth())
        assert s.json()["status"] == "succeeded"
        resp = client.delete("/api/jobs/5", headers=_auth())
    assert resp.status_code == 409


def test_cancel_502_on_slurm_error():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            return httpx.Response(200, json={"job_id": 11})
        if req.method == "DELETE":
            return httpx.Response(500, json={"errors": ["boom"]})
        return httpx.Response(200, json={"jobs": [{"job_id": 11,
                                                       "job_state": ["RUNNING"]}]})

    app = _build_app(handler)
    with TestClient(app) as client:
        _submit(client)
        resp = client.delete("/api/jobs/11", headers=_auth())
    assert resp.status_code == 502


def test_cancel_401_on_missing_auth():
    app = _build_app(lambda r: httpx.Response(200, json={"job_id": 1}))
    with TestClient(app) as client:
        _submit(client)
        resp = client.delete("/api/jobs/1", headers={"X-User": "alice"})
    assert resp.status_code == 401


# --------------------------------------------------------------- grace period

def test_cancel_grace_period_delays_scancel():
    """A queued, freshly-submitted job must wait up to the grace period."""

    timings = {"submitted_at": 0.0, "deleted_at": 0.0}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "POST":
            timings["submitted_at"] = time.monotonic()
            return httpx.Response(200, json={"job_id": 22})
        if req.method == "DELETE":
            timings["deleted_at"] = time.monotonic()
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"jobs": [{"job_id": 22,
                                                       "job_state": ["PENDING"]}]})

    app = _build_app(handler, slurm_cancel_grace_period_s=0.3)
    with TestClient(app) as client:
        _submit(client)
        # Cancel immediately; grace period should make scancel land >= 0.25s
        # later (allowing a small scheduling slack).
        resp = client.delete("/api/jobs/22", headers=_auth())
    assert resp.status_code == 200
    delay = timings["deleted_at"] - timings["submitted_at"]
    assert delay >= 0.25, f"grace period not honoured: delay={delay:.3f}s"


# -------------------------------------------------------------- mock-mode E2E

def test_mock_mode_cancel_flow_end_to_end():
    settings = Settings(
        slurm_mock_mode=True,
        slurm_status_poll_interval_s=0.05,
        slurm_status_cache_ttl_s=0.0,
        slurm_cancel_grace_period_s=0.0,
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        job_id = _submit(client)
        cancel = client.delete(f"/api/jobs/{job_id}", headers=_auth())
        assert cancel.status_code == 200
        assert cancel.json()["status"] == "cancelled"
        # Subsequent status read returns cancelled, not 404.
        status = client.get(f"/api/jobs/{job_id}/status", headers=_auth())
        assert status.status_code == 200
        assert status.json()["status"] == "cancelled"
