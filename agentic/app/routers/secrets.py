"""Vault-backed secret retrieval (Task 1.5).

Exposes ``GET /api/secrets/{secret_type}`` so an agent runtime can fetch
short-lived credentials (search API key, GitHub PAT, OIDC token) for the
authenticated caller. The actual Vault round-trip is mediated by
:class:`SecretCache` on top of :class:`VaultClient` (mockable for tests).

Status mapping (matches Task 1.5 acceptance criteria):

* 401 missing / invalid X-User
* 404 secret not found in Vault
* 410 secret found but expired (lease in the past)
* 502 Vault unavailable
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.clients.vault import (
    VaultAuthError,
    VaultError,
    VaultExpiredError,
    VaultForbiddenError,
    VaultNotFoundError,
    VaultUnavailableError,
)
from app.dependencies import get_secret_cache, get_user_id
from app.models.secret import SecretResponse, SecretType
from app.services.secret_cache import SecretCache


log = logging.getLogger("agentic.secrets")

router = APIRouter(prefix="/api/secrets", tags=["secrets"])


@router.get(
    "/{secret_type}",
    response_model=SecretResponse,
    responses={
        401: {"description": "Authentication failed"},
        404: {"description": "Secret not found"},
        410: {"description": "Secret expired"},
        502: {"description": "Vault unavailable"},
    },
)
async def get_secret(
    secret_type: SecretType,
    user_id: str = Depends(get_user_id),
    cache: SecretCache = Depends(get_secret_cache),
) -> SecretResponse:
    log.info(
        "secret_read_received",
        extra={"user_id": user_id, "secret_type": secret_type.value},
    )
    try:
        secret = await cache.get(user_id=user_id, secret_type=secret_type)
    except VaultNotFoundError as exc:
        log.info(
            "secret_not_found",
            extra={"user_id": user_id, "secret_type": secret_type.value},
        )
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except VaultExpiredError as exc:
        log.info(
            "secret_expired",
            extra={"user_id": user_id, "secret_type": secret_type.value},
        )
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except (VaultAuthError, VaultForbiddenError) as exc:
        # Vault should always accept the broker's own token. Surface this
        # as 502 to the caller (the user's request is correct; the broker
        # has a config problem) rather than 401.
        log.error(
            "secret_vault_auth_failed",
            extra={"user_id": user_id, "error": str(exc)},
        )
        raise HTTPException(status_code=502, detail="vault auth failed") from exc
    except VaultUnavailableError as exc:
        log.warning(
            "secret_vault_unavailable",
            extra={"user_id": user_id, "error": str(exc)},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except VaultError as exc:
        log.warning(
            "secret_vault_error",
            extra={"user_id": user_id, "error": str(exc)},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    log.info(
        "secret_read_ok",
        extra={
            "user_id": user_id,
            "secret_type": secret_type.value,
            # Do not log the value or any prefix of it.
            "expires_at": secret.expires_at,
        },
    )
    return SecretResponse(
        secret_type=secret_type,
        value=secret.value,
        expires_at=secret.expires_at,
    )
