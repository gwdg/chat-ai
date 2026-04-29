"""Async HashiCorp Vault client (KV v2).

Why httpx and not ``hvac``?
---------------------------
``hvac`` is a synchronous library; calling it from a FastAPI request handler
would block the event loop for every Vault round-trip. We mirror the design
already used for slurmrestd: a thin async wrapper over ``httpx.AsyncClient``
that is pluggable via ``httpx.MockTransport`` for tests.

Error taxonomy maps directly onto the HTTP statuses required by Task 1.5:

* 401 Unauthorized        -> ``VaultAuthError``
* 403 Forbidden           -> ``VaultForbiddenError``
* 404 Not Found / no data -> ``VaultNotFoundError``
* 410 Gone (expired lease)-> ``VaultExpiredError``
* anything else / 5xx     -> ``VaultUnavailableError`` (502 to caller)

Mock mode (``settings.vault_mock_mode=True``) returns deterministic synthetic
secrets without touching the network so the broker can be exercised on a
dev VM with no Vault available.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Mapping, Optional

import httpx

from app.config import Settings
from app.models.secret import SecretType


log = logging.getLogger("agentic.vault")


class VaultError(Exception):
    """Base class for Vault client errors mapped to HTTP responses."""

    http_status: int = 502

    def __init__(self, message: str, *, detail: Any = None) -> None:
        super().__init__(message)
        self.detail = detail


class VaultAuthError(VaultError):
    http_status = 401


class VaultForbiddenError(VaultError):
    http_status = 403


class VaultNotFoundError(VaultError):
    http_status = 404


class VaultExpiredError(VaultError):
    http_status = 410


class VaultUnavailableError(VaultError):
    http_status = 502


@dataclass
class SecretValue:
    """Raw secret payload returned by the client.

    ``value`` is the actual credential string. ``expires_at`` is either an
    ISO-8601 UTC timestamp derived from Vault's ``lease_duration`` /
    ``ttl`` metadata, or ``None`` when no TTL is advertised.
    """

    value: str
    expires_at: Optional[str] = None


class VaultClient:
    """Thin async wrapper around the Vault KV-v2 read endpoint."""

    def __init__(
        self,
        settings: Settings,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._settings = settings
        self._client = http_client or httpx.AsyncClient(
            base_url=settings.vault_base_url,
            timeout=httpx.Timeout(settings.vault_request_timeout_s),
        )
        self._owns_client = http_client is None

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ----------------------------------------------------------- public API
    async def get_user_secret(
        self,
        *,
        user_id: str,
        secret_type: SecretType,
    ) -> SecretValue:
        """Fetch a single secret for ``user_id`` of type ``secret_type``.

        See :class:`VaultError` subclasses for the failure modes; the
        secrets router maps each one to its corresponding HTTP status.
        """
        if self._settings.vault_mock_mode:
            return self._mock_secret(user_id=user_id, secret_type=secret_type)

        path = self._build_path(user_id=user_id, secret_type=secret_type)
        url = f"/v1/{self._settings.vault_kv_mount}/data/{path}"
        headers: Dict[str, str] = {
            "X-Vault-Token": self._settings.vault_token,
            "Accept": "application/json",
        }
        if self._settings.vault_namespace:
            headers["X-Vault-Namespace"] = self._settings.vault_namespace

        log.info(
            "vault_read_request",
            extra={
                "user_id": user_id,
                "secret_type": secret_type.value,
                "url": url,
                # Never log the secret value or token here.
            },
        )
        response = await self._send_with_retries("GET", url, headers)
        body = self._safe_json(response)

        log.info(
            "vault_read_response",
            extra={
                "user_id": user_id,
                "secret_type": secret_type.value,
                "status_code": response.status_code,
                "found": (
                    response.status_code == 200
                    and isinstance(body, dict)
                    and bool(body.get("data"))
                ),
            },
        )

        self._raise_for_status(response, body)
        return self._parse_kv_v2(body, secret_type=secret_type)

    # ----------------------------------------------------------- internals
    def _build_path(self, *, user_id: str, secret_type: SecretType) -> str:
        user_part, _, tenant_part = user_id.partition("@")
        return self._settings.vault_path_template.format(
            user_id=user_part,
            tenant_id=tenant_part,
            secret_type=secret_type.value,
        )

    def _mock_secret(
        self, *, user_id: str, secret_type: SecretType
    ) -> SecretValue:
        """Deterministic fake secret used when ``vault_mock_mode`` is on.

        Reserved sentinel user-id ``expired`` (with or without ``@tenant``
        suffix) drives the 410 Gone path; ``missing`` drives the 404 path.
        Anything else returns a synthetic value with a 30-minute TTL.
        """
        user_part, _, _tenant_part = user_id.partition("@")
        if user_part == "missing":
            raise VaultNotFoundError(
                f"mock vault: no secret for {user_id}/{secret_type.value}"
            )
        ttl_seconds = -60 if user_part == "expired" else 30 * 60
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        ).isoformat()
        if ttl_seconds <= 0:
            raise VaultExpiredError(
                f"mock vault: {secret_type.value} for {user_id} has expired"
            )
        log.info(
            "vault_read_mock",
            extra={"user_id": user_id, "secret_type": secret_type.value},
        )
        return SecretValue(
            value=f"mock-{secret_type.value}-{user_id}",
            expires_at=expires_at,
        )

    def _parse_kv_v2(
        self, body: Any, *, secret_type: SecretType
    ) -> SecretValue:
        if not isinstance(body, dict):
            raise VaultError("vault returned non-object body", detail=body)

        # KV-v2 response shape: {"data": {"data": {<key>: <value>}, "metadata":{...}}}
        data_outer = body.get("data")
        if not isinstance(data_outer, dict):
            raise VaultNotFoundError("vault response missing data", detail=body)
        data_inner = data_outer.get("data")
        if not isinstance(data_inner, dict) or not data_inner:
            raise VaultNotFoundError("vault payload empty", detail=body)

        # Allow either a key matching the secret type ("github_pat": "...")
        # or a generic "value" field. Prefer the typed key.
        raw_value = data_inner.get(secret_type.value)
        if raw_value is None:
            raw_value = data_inner.get("value")
        if raw_value is None:
            raise VaultNotFoundError(
                f"vault payload missing '{secret_type.value}' / 'value' key",
                detail=body,
            )
        if not isinstance(raw_value, str) or not raw_value:
            raise VaultError(
                f"vault returned non-string value for {secret_type.value}",
                detail=None,
            )

        # KV-v2 advertises lease info on the top-level body, not inside
        # data.metadata. Either may carry "ttl" / "lease_duration".
        ttl = self._extract_ttl(body, data_outer)

        expires_at: Optional[str] = None
        if ttl is not None:
            if ttl <= 0:
                raise VaultExpiredError(
                    f"vault secret {secret_type.value} already expired",
                    detail={"ttl": ttl},
                )
            expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=int(ttl))
            ).isoformat()

        return SecretValue(value=raw_value, expires_at=expires_at)

    @staticmethod
    def _extract_ttl(body: Mapping[str, Any], data_outer: Mapping[str, Any]) -> Optional[int]:
        for source in (body, data_outer):
            for key in ("ttl", "lease_duration"):
                v = source.get(key)
                if isinstance(v, (int, float)) and v != 0:
                    return int(v)
        meta = data_outer.get("metadata") if isinstance(data_outer, dict) else None
        if isinstance(meta, dict):
            for key in ("ttl", "lease_duration"):
                v = meta.get(key)
                if isinstance(v, (int, float)) and v != 0:
                    return int(v)
        return None

    async def _send_with_retries(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
    ) -> httpx.Response:
        s = self._settings
        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt <= s.vault_max_retries:
            try:
                response = await self._client.request(
                    method, url, headers=headers
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                if attempt == s.vault_max_retries:
                    raise VaultUnavailableError(
                        f"vault unreachable: {exc!s}"
                    ) from exc
                await asyncio.sleep(s.vault_retry_backoff_s * (2 ** attempt))
                attempt += 1
                continue

            if 500 <= response.status_code < 600 and attempt < s.vault_max_retries:
                log.warning(
                    "vault_transient_5xx",
                    extra={
                        "status_code": response.status_code,
                        "attempt": attempt,
                    },
                )
                await asyncio.sleep(s.vault_retry_backoff_s * (2 ** attempt))
                attempt += 1
                continue

            return response

        assert last_exc is not None
        raise VaultUnavailableError(str(last_exc)) from last_exc

    @staticmethod
    def _safe_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    @staticmethod
    def _raise_for_status(response: httpx.Response, body: Any) -> None:
        sc = response.status_code
        if sc < 400:
            return
        if sc == 400:
            raise VaultError("vault rejected request", detail=body)
        if sc == 401:
            raise VaultAuthError("vault authentication failed", detail=body)
        if sc == 403:
            raise VaultForbiddenError("vault permission denied", detail=body)
        if sc == 404:
            raise VaultNotFoundError("vault path not found", detail=body)
        if 500 <= sc < 600:
            raise VaultUnavailableError(
                "vault service unavailable", detail=body
            )
        raise VaultError(f"unexpected vault status {sc}", detail=body)
