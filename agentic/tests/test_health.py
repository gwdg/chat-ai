"""Tests for Task 1.1 acceptance criteria."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_health_returns_healthy() -> None:
    resp = _client().get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_cors_headers_present_for_allowed_origin() -> None:
    origin = "http://localhost:3000"
    resp = _client().options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == origin


def test_request_id_header_added() -> None:
    resp = _client().get("/health")
    assert "x-request-id" in {k.lower() for k in resp.headers.keys()}
