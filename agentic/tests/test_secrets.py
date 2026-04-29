"""Tests for Task 1.5: Vault Secret Retrieval.

The Vault HTTP API is mocked with ``httpx.MockTransport`` so the suite
runs entirely in-process — no Vault install, no network, no HPC required.
"""

from __future__ import annotations

import asyncio
from typing import Callable, Dict

import httpx
import pytest
from fastapi.testclient import TestClient

from app.clients.vault import VaultClient
from app.config import Settings
from app.dependencies import get_settings
from app.main import create_app
from app.models.secret import SecretType
from app.services.secret_cache import SecretCache


# ----------------------------------------------------------- helpers ---------


def _build_app(
    handler: Callable[[httpx.Request], httpx.Response],
    *,
    cache_ttl_s: float = 60.0,
    max_retries: int = 0,
):
    """Construct a FastAPI app whose VaultClient talks to ``handler``."""
    settings = Settings(
        vault_base_url="http://vault.test",
        vault_token="root-token",
        vault_kv_mount="kv",
        vault_max_retries=max_retries,
        vault_retry_backoff_s=0.0,
        vault_cache_ttl_s=cache_ttl_s,
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(
        transport=transport, base_url=settings.vault_base_url
    )
    app.state.vault_client = VaultClient(settings, http_client=http_client)
    return app


def _auth(user: str = "alice@gwdg") -> Dict[str, str]:
    return {
        "Authorization": "Bearer test-token",
        "X-User": user,
        "Content-Type": "application/json",
    }


def _kv_v2_body(
    *,
    key: str = "search_api_key",
    value: str = "sk-secret",
    ttl: int = 1800,
) -> Dict:
    return {
        "request_id": "abc",
        "lease_id": "",
        "renewable": False,
        "lease_duration": ttl,
        "data": {
            "data": {key: value},
            "metadata": {"version": 1},
        },
    }


# ------------------------------------------------------ happy path -----------


def test_get_secret_returns_value_and_expiry():
    captured: Dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["token"] = request.headers.get("x-vault-token")
        return httpx.Response(200, json=_kv_v2_body())

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["secret_type"] == "search_api_key"
    assert body["value"] == "sk-secret"
    assert body["expires_at"] is not None

    assert captured["token"] == "root-token"
    # URL must use the configured KV mount and the rendered path template
    # with both the user_id and tenant components honoured.
    assert captured["url"].endswith(
        "/v1/kv/data/users/alice/secrets/search_api_key"
    )


def test_kv_v2_value_field_fallback():
    """If Vault stores the secret under "value" instead of the typed key,
    the client must still find it."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": {
                    "data": {"value": "ghp_abc"},
                    "metadata": {},
                },
                "lease_duration": 0,
            },
        )

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/github_pat", headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["value"] == "ghp_abc"
    # No TTL advertised → expires_at omitted
    assert resp.json()["expires_at"] is None


def test_invalid_secret_type_returns_422():
    app = _build_app(lambda r: httpx.Response(500))
    with TestClient(app) as client:
        resp = client.get("/api/secrets/not_a_real_type", headers=_auth())
    assert resp.status_code == 422


# ----------------------------------------------- auth & error mapping -------


def test_missing_x_user_returns_401():
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("Vault should not be called")

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get(
            "/api/secrets/search_api_key",
            headers={"Authorization": "Bearer x"},
        )
    assert resp.status_code == 401


def test_vault_404_maps_to_404():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"errors": ["not found"]})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/oidc_token", headers=_auth())
    assert resp.status_code == 404


def test_vault_returns_empty_data_maps_to_404():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"data": {}, "metadata": {}}})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/oidc_token", headers=_auth())
    assert resp.status_code == 404


def test_negative_ttl_maps_to_410_gone():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_kv_v2_body(ttl=-5))

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())
    assert resp.status_code == 410


def test_vault_5xx_maps_to_502():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"errors": ["boom"]})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())
    assert resp.status_code == 502


def test_vault_unreachable_maps_to_502():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())
    assert resp.status_code == 502


def test_vault_401_maps_to_502():
    """Vault auth failures are *broker config* problems, not user errors —
    they must surface as 502, not 401, to avoid misleading the caller."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"errors": ["invalid token"]})

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())
    assert resp.status_code == 502


def test_secret_value_never_appears_in_response_status_line():
    """Smoke: the response JSON contains only the documented fields."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=_kv_v2_body(value="VERY-SECRET-VALUE")
        )

    app = _build_app(handler)
    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())

    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"secret_type", "value", "expires_at"}
    # And the value is exactly what Vault returned (no truncation).
    assert body["value"] == "VERY-SECRET-VALUE"


# ----------------------------------------------------------- cache -----------


def test_cache_hit_avoids_second_vault_call():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=_kv_v2_body())

    app = _build_app(handler, cache_ttl_s=60.0)
    with TestClient(app) as client:
        for _ in range(5):
            r = client.get("/api/secrets/search_api_key", headers=_auth())
            assert r.status_code == 200
    # 5 reads served from one upstream call.
    assert calls["n"] == 1


def test_cache_disabled_when_ttl_zero():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=_kv_v2_body())

    app = _build_app(handler, cache_ttl_s=0.0)
    with TestClient(app) as client:
        for _ in range(3):
            r = client.get("/api/secrets/search_api_key", headers=_auth())
            assert r.status_code == 200
    assert calls["n"] == 3


def test_cache_isolates_secret_types_and_users():
    """Different (user, secret_type) combos must not collide in cache."""

    served: Dict[str, int] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        served[path] = served.get(path, 0) + 1
        # Echo the path's last segment so each (user, type) sees a
        # distinct value.
        last = path.rsplit("/", 1)[-1]
        return httpx.Response(200, json=_kv_v2_body(key=last, value=f"v-{last}"))

    app = _build_app(handler, cache_ttl_s=60.0)
    with TestClient(app) as client:
        a = client.get("/api/secrets/search_api_key", headers=_auth("alice@gwdg"))
        b = client.get("/api/secrets/github_pat", headers=_auth("alice@gwdg"))
        c = client.get("/api/secrets/search_api_key", headers=_auth("bob@gwdg"))

    assert a.json()["value"] == "v-search_api_key"
    assert b.json()["value"] == "v-github_pat"
    assert c.json()["value"] == "v-search_api_key"
    # Three distinct keys → three upstream reads, but one each (no extras).
    assert all(v == 1 for v in served.values())


# ----------------------------------------------- mock-mode E2E (no network) -


def test_mock_mode_returns_synthetic_secret_without_calling_vault():
    settings = Settings(vault_mock_mode=True, vault_cache_ttl_s=0.0)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("Vault must not be called in mock mode")

    transport = httpx.MockTransport(handler)
    app.state.vault_client = VaultClient(
        settings, http_client=httpx.AsyncClient(transport=transport)
    )

    with TestClient(app) as client:
        resp = client.get("/api/secrets/search_api_key", headers=_auth())
    assert resp.status_code == 200
    body = resp.json()
    assert body["value"].startswith("mock-search_api_key")
    assert body["expires_at"] is not None


def test_mock_mode_expired_user_returns_410():
    settings = Settings(vault_mock_mode=True, vault_cache_ttl_s=0.0)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.state.vault_client = VaultClient(settings)
    with TestClient(app) as client:
        resp = client.get(
            "/api/secrets/github_pat", headers=_auth("expired@gwdg")
        )
    assert resp.status_code == 410


def test_mock_mode_missing_user_returns_404():
    settings = Settings(vault_mock_mode=True, vault_cache_ttl_s=0.0)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.state.vault_client = VaultClient(settings)
    with TestClient(app) as client:
        resp = client.get(
            "/api/secrets/oidc_token", headers=_auth("missing@gwdg")
        )
    assert resp.status_code == 404


# -------------------------------------------- direct cache concurrency test -


@pytest.mark.asyncio
async def test_cache_collapses_concurrent_misses_to_one_upstream_call():
    """Stampeding-cache protection: 20 concurrent requests for the same
    secret should result in a single Vault read."""

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=_kv_v2_body())

    settings = Settings(
        vault_base_url="http://vault.test",
        vault_token="t",
        vault_max_retries=0,
        vault_cache_ttl_s=60.0,
    )
    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(
        transport=transport, base_url=settings.vault_base_url
    )
    vault = VaultClient(settings, http_client=http_client)
    cache = SecretCache(settings, vault)

    results = await asyncio.gather(
        *(
            cache.get(user_id="alice@gwdg", secret_type=SecretType.SEARCH_API_KEY)
            for _ in range(20)
        )
    )
    assert all(r.value == "sk-secret" for r in results)
    assert calls["n"] == 1
    assert cache.misses == 1
    assert cache.hits == 19
    await http_client.aclose()
