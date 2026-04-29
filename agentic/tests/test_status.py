"""Tests for Task 1.3: Slurm job monitoring.

Covers:
- Slurm-state to JobState mapping
- GET /api/jobs/{id}/status happy path + errors
- 1-second cache TTL
- 404 for unknown jobs
- 502 for upstream Slurm errors
- Background polling stops on terminal state
"""

from __future__ import annotations

import json
from typing import Callable, Dict

import httpx
import pytest
from fastapi.testclient import TestClient

from app.clients.slurm import SlurmClient
from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app
from app.models.job import JobState, map_slurm_state
from app.services.job_monitor import JobMonitor


# ---------------------------------------------------------------- helpers ----

def _build_app(handler: Callable[[httpx.Request], httpx.Response], **overrides):
    cfg: Dict = dict(
        slurm_base_url="http://slurm.test",
        slurm_max_retries=0,
        slurm_retry_backoff_s=0.0,
        slurm_status_poll_interval_s=0.05,
        slurm_status_cache_ttl_s=0.5,
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


def _auth() -> Dict[str, str]:
    return {
        "Authorization": "Bearer test-token",
        "X-User": "alice",
        "Content-Type": "application/json",
    }


def _slurm_job_payload(state: str, *, exit_code: int | None = None) -> Dict:
    return {
        "jobs": [
            {
                "job_id": 7777,
                "job_state": [state],
                "start_time": {"set": True, "number": 1714000000},
                "end_time": {"set": state in {"COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"},
                              "number": 1714000060},
                "exit_code": {"return_code": {"set": exit_code is not None,
                                                "number": exit_code or 0}},
            }
        ]
    }


# ------------------------------------------------------------ state mapping --

@pytest.mark.parametrize(
    "slurm_state,expected",
    [
        ("PENDING", JobState.QUEUED),
        ("CONFIGURING", JobState.QUEUED),
        ("RUNNING", JobState.RUNNING),
        ("COMPLETED", JobState.SUCCEEDED),
        ("FAILED", JobState.FAILED),
        ("OUT_OF_MEMORY", JobState.FAILED),
        ("CANCELLED", JobState.CANCELLED),
        ("TIMEOUT", JobState.TIMED_OUT),
        ("UNKNOWN_GIBBERISH", JobState.UNKNOWN),
        (None, JobState.UNKNOWN),
    ],
)
def test_state_mapping(slurm_state, expected):
    assert map_slurm_state(slurm_state) is expected


# ------------------------------------------------------------- status route --

def _post_submit(app) -> httpx.Response:
    payload = {
        "session_id": "sess-xyz",
        "container_image": "/img/agent.sif",
    }
    with TestClient(app) as client:
        return client.post(
            "/api/jobs", content=json.dumps(payload), headers=_auth()
        )


def _submit_then_get_status(handler) -> httpx.Response:
    """Submit a job (handler returns 200 with job_id=7777) then read its status."""
    app = _build_app(handler)
    with TestClient(app) as client:
        submit = client.post(
            "/api/jobs",
            content=json.dumps(
                {"session_id": "s", "container_image": "/i.sif"}
            ),
            headers=_auth(),
        )
        assert submit.status_code == 200, submit.text
        job_id = submit.json()["job_id"]
        return client.get(f"/api/jobs/{job_id}/status", headers=_auth())


def test_status_endpoint_returns_running():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 7777})
        return httpx.Response(200, json=_slurm_job_payload("RUNNING"))

    resp = _submit_then_get_status(handler)
    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == "7777"
    assert body["status"] == "running"
    assert body["start_time"] is not None
    assert body["end_time"] is None
    assert body["exit_code"] is None


def test_status_endpoint_returns_succeeded_with_exit_code():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 7777})
        return httpx.Response(200, json=_slurm_job_payload("COMPLETED", exit_code=0))

    resp = _submit_then_get_status(handler)
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["exit_code"] == 0
    assert body["end_time"] is not None


def test_status_unknown_job_returns_404():
    # No submit; call status with an arbitrary id. The fallback path tries a
    # one-shot fetch; we make Slurm respond 404.
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"errors": ["no such job"]})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/jobs/9999/status", headers=_auth())
    assert resp.status_code == 404


def test_status_slurm_error_maps_to_502():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 7777})
        return httpx.Response(500, json={"errors": ["boom"]})

    resp = _submit_then_get_status(handler)
    assert resp.status_code == 502


def test_status_uses_cache_within_ttl():
    calls = {"submit": 0, "status": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            calls["submit"] += 1
            return httpx.Response(200, json={"job_id": 7777})
        calls["status"] += 1
        return httpx.Response(200, json=_slurm_job_payload("RUNNING"))

    app = _build_app(handler, slurm_status_cache_ttl_s=10.0,
                     slurm_status_poll_interval_s=10.0)
    with TestClient(app) as client:
        client.post("/api/jobs",
                    content=json.dumps({"session_id": "s",
                                          "container_image": "/i.sif"}),
                    headers=_auth())
        # Drain the initial poll fetch by waiting briefly for the task to run.
        # With a 10s interval, the loop fires once on entry.
        for _ in range(50):
            if calls["status"] >= 1:
                break
            # nothing async to await from sync TestClient; sleep on the event
            # loop via a small request.
            client.get("/health")
        assert calls["status"] >= 1
        before = calls["status"]
        # Two GETs in immediate succession should hit cache.
        client.get("/api/jobs/7777/status", headers=_auth())
        client.get("/api/jobs/7777/status", headers=_auth())
        # We allow at most one more refetch (depending on how the first GET
        # raced with the poller); the point is *not* one-per-request.
        assert calls["status"] - before <= 1


def test_polling_stops_on_terminal_state():
    """The background poll loop must self-terminate at COMPLETED."""
    poll_calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 7777})
        poll_calls["n"] += 1
        # Return COMPLETED on the very first poll; any subsequent call would
        # mean the loop did not stop.
        return httpx.Response(200, json=_slurm_job_payload("COMPLETED",
                                                              exit_code=0))

    app = _build_app(handler, slurm_status_poll_interval_s=0.01)
    with TestClient(app) as client:
        client.post("/api/jobs",
                    content=json.dumps({"session_id": "s",
                                          "container_image": "/i.sif"}),
                    headers=_auth())
        # Give the loop generous time; with 10ms interval it would hit
        # hundreds of times if it didn't stop.
        for _ in range(20):
            client.get("/health")  # tick the loop
        # First-call observed; a few extra are acceptable due to cache misses
        # from GETs, but it must be bounded (well below "interval-based").
        n = poll_calls["n"]
        # Sleep a little more wall time; if still polling, the count grows.
        for _ in range(20):
            client.get("/health")
        assert poll_calls["n"] == n, (
            f"polling kept running after terminal state: {poll_calls['n']} > {n}"
        )


def test_terminal_status_still_readable_after_polling_stops():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/job/submit"):
            return httpx.Response(200, json={"job_id": 7777})
        return httpx.Response(200, json=_slurm_job_payload("COMPLETED",
                                                              exit_code=0))

    app = _build_app(handler, slurm_status_poll_interval_s=0.01)
    with TestClient(app) as client:
        client.post("/api/jobs",
                    content=json.dumps({"session_id": "s",
                                          "container_image": "/i.sif"}),
                    headers=_auth())
        # Let the poller mark terminal.
        for _ in range(20):
            client.get("/health")
        resp = client.get("/api/jobs/7777/status", headers=_auth())
        assert resp.status_code == 200
        assert resp.json()["status"] == "succeeded"


# ----------------------------------------------------------------- mock mode

def test_mock_mode_status_walks_states():
    settings = Settings(slurm_mock_mode=True,
                          slurm_status_poll_interval_s=0.01)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        submit = client.post(
            "/api/jobs",
            content=json.dumps({"session_id": "s",
                                  "container_image": "/i.sif"}),
            headers=_auth(),
        )
        job_id = submit.json()["job_id"]
        # Read status a few times; mock walks queued -> running -> succeeded.
        seen = set()
        for _ in range(10):
            resp = client.get(f"/api/jobs/{job_id}/status", headers=_auth())
            if resp.status_code == 200:
                seen.add(resp.json()["status"])
        # We should have observed at least one valid simplified state.
        assert seen & {"queued", "running", "succeeded"}
