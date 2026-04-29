"""Tests for Task 1.2: Slurm job submission.

The Slurm REST API is mocked with ``httpx.MockTransport`` so the suite
runs entirely in-process — no Slurm install, no network, no HPC required.
"""

from __future__ import annotations

import json
from typing import Callable, Dict, List

import httpx
from fastapi.testclient import TestClient

from app.clients.slurm import SlurmClient
from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app


VALID_REQUEST: Dict = {
    "session_id": "sess-abc",
    "container_image": "/cluster/images/agent.sif",
    "environment": {"VAULT_TOKEN": "redacted"},
}


def _build_app(handler: Callable[[httpx.Request], httpx.Response], *, max_retries: int = 0):
    """Construct a FastAPI app whose SlurmClient talks to ``handler``."""
    settings = Settings(
        slurm_base_url="http://slurm.test",
        slurm_max_retries=max_retries,
        slurm_retry_backoff_s=0.0,  # no real sleeping in tests
    )
    app = create_app(settings)
    # Pin settings so dependency-injected callers see the same instance.
    app.dependency_overrides[get_settings] = lambda: settings

    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(
        transport=transport,
        base_url=settings.slurm_base_url,
    )
    app.state.slurm_client = SlurmClient(settings, http_client=http_client)
    return app


def _post(app, body=None, *, headers=None) -> httpx.Response:
    base_headers = {
        "Authorization": "Bearer test-token",
        "X-User": "alice",
        "Content-Type": "application/json",
    }
    if headers:
        base_headers.update(headers)
    with TestClient(app) as client:
        return client.post(
            "/api/jobs",
            content=json.dumps(body if body is not None else VALID_REQUEST),
            headers=base_headers,
        )


def test_submit_success_returns_job_id_and_forwards_bearer():
    captured: Dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"job_id": 12345, "errors": [], "warnings": []})

    app = _build_app(handler)
    resp = _post(app)

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"job_id": "12345", "status": "submitted"}

    assert captured["auth"] == "Bearer test-token"
    assert captured["url"].endswith("/slurm/v0.0.40/job/submit")

    job = captured["body"]["job"]
    assert job["partition"] == "grete:interactive"
    assert job["time_limit"] == 30
    assert job["memory_per_node"] == 16 * 1024
    assert job["cpus_per_task"] == 4
    assert job["container"] == "/cluster/images/agent.sif"
    # Proxy + caller-supplied env both injected.
    env: List[str] = job["environment"]
    assert "HTTP_PROXY=http://www-cache.gwdg.de:3128" in env
    assert "VAULT_TOKEN=redacted" in env


def test_missing_authorization_returns_401():
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("Slurm should not be called")

    app = _build_app(handler)
    resp = _post(app, headers={"Authorization": ""})
    assert resp.status_code == 401


def test_missing_x_user_returns_401():
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("Slurm should not be called")

    app = _build_app(handler)
    resp = _post(app, headers={"X-User": ""})
    assert resp.status_code == 401


def test_invalid_payload_returns_422():
    app = _build_app(lambda r: httpx.Response(200, json={"job_id": 1}))
    resp = _post(app, body={"session_id": ""})  # missing container_image
    assert resp.status_code == 422


def test_slurm_400_maps_to_400():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"errors": ["bad partition"]})

    resp = _post(_build_app(handler))
    assert resp.status_code == 400


def test_slurm_401_maps_to_401():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"errors": ["bad token"]})

    resp = _post(_build_app(handler))
    assert resp.status_code == 401


def test_slurm_403_maps_to_403():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"errors": ["no permission"]})

    resp = _post(_build_app(handler))
    assert resp.status_code == 403


def test_slurm_5xx_maps_to_503():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"errors": ["boom"]})

    resp = _post(_build_app(handler))
    assert resp.status_code == 503


def test_slurm_unreachable_maps_to_503():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    resp = _post(_build_app(handler))
    assert resp.status_code == 503


def test_retries_on_transient_5xx_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(502, json={"errors": ["bad gw"]})
        return httpx.Response(200, json={"job_id": 99})

    app = _build_app(handler, max_retries=3)
    resp = _post(app)
    assert resp.status_code == 200
    assert resp.json()["job_id"] == "99"
    assert calls["n"] == 3


def test_application_level_errors_in_200_body_map_to_400():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"errors": ["partition unknown"], "job_id": None})

    resp = _post(_build_app(handler))
    assert resp.status_code == 400


def test_mock_mode_short_circuits_without_calling_slurm():
    settings = Settings(slurm_mock_mode=True)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("Slurm should not be called in mock mode")

    transport = httpx.MockTransport(handler)
    app.state.slurm_client = SlurmClient(
        settings, http_client=httpx.AsyncClient(transport=transport)
    )

    resp = _post(app)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "submitted"
    assert body["job_id"].startswith("mock-")
