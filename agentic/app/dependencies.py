"""Reusable FastAPI dependencies.

Centralises auth-header parsing and Slurm-client construction so individual
routers stay slim and tests can override them via ``app.dependency_overrides``.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status

from app.clients.slurm import SlurmClient
from app.clients.vault import VaultClient
from app.config import Settings, get_settings
from app.services.job_monitor import JobMonitor
from app.services.secret_cache import SecretCache
from app.services.sse_hub import SseHub


def get_bearer_token(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract the Bearer token from the inbound Authorization header.

    Per Task 1.2 acceptance criteria, missing / malformed credentials must
    surface as 401 Unauthorized.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must use Bearer scheme",
        )
    return parts[1].strip()


def get_user_id(
    request: Request,
    x_user: Optional[str] = Header(default=None, alias="X-User"),
) -> str:
    """Return the X-User identity set by the Kong auth stack (FR-002).

    When the auth middleware is enabled (Task 1.7) it has already
    validated the format and populated ``request.state.full_user``. We
    prefer that pre-validated value to avoid re-parsing the header.

    When the middleware is disabled (e.g. in unit tests that target a
    single dependency in isolation), fall back to the raw header.
    """
    pre_validated = getattr(request.state, "full_user", None)
    if pre_validated:
        return str(pre_validated)
    if not x_user or not x_user.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User header",
        )
    return x_user.strip()


def get_tenant_id(request: Request) -> str:
    """Tenant slug extracted from X-User by the auth middleware.

    Returns "" when middleware is disabled or the header has no tenant
    suffix (kept loose so existing tests with bare ``alice`` still work).
    """
    return str(getattr(request.state, "tenant_id", "") or "")


async def get_slurm_client(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SlurmClient:
    """Return the app-scoped SlurmClient, creating it lazily on first use.

    The client is stored on ``app.state`` so a single ``httpx.AsyncClient``
    (with its connection pool) is reused across requests. Tests inject their
    own client by setting ``app.state.slurm_client`` before calling the API.
    """
    client: Optional[SlurmClient] = getattr(request.app.state, "slurm_client", None)
    if client is None:
        client = SlurmClient(settings)
        request.app.state.slurm_client = client
    return client


async def get_job_monitor(
    request: Request,
    settings: Settings = Depends(get_settings),
    slurm: SlurmClient = Depends(get_slurm_client),
) -> JobMonitor:
    """Return the app-scoped JobMonitor, creating it lazily on first use."""
    monitor: Optional[JobMonitor] = getattr(request.app.state, "job_monitor", None)
    if monitor is None:
        monitor = JobMonitor(settings, slurm)
        request.app.state.job_monitor = monitor
    return monitor


async def get_vault_client(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> VaultClient:
    """Return the app-scoped VaultClient, creating it lazily on first use.

    Tests inject their own client by setting ``app.state.vault_client``
    before calling the API (mirroring the slurm client pattern).
    """
    client: Optional[VaultClient] = getattr(request.app.state, "vault_client", None)
    if client is None:
        client = VaultClient(settings)
        request.app.state.vault_client = client
    return client


async def get_secret_cache(
    request: Request,
    settings: Settings = Depends(get_settings),
    vault: VaultClient = Depends(get_vault_client),
) -> SecretCache:
    """Return the app-scoped SecretCache, creating it lazily on first use."""
    cache: Optional[SecretCache] = getattr(request.app.state, "secret_cache", None)
    if cache is None:
        cache = SecretCache(settings, vault)
        request.app.state.secret_cache = cache
    return cache


async def get_sse_hub(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SseHub:
    """Return the app-scoped SseHub, creating it lazily on first use.

    The reaper task is started here on first access so unit tests can
    create an app and run a single request without spinning up the
    background loop until they actually subscribe.
    """
    hub: Optional[SseHub] = getattr(request.app.state, "sse_hub", None)
    if hub is None:
        hub = SseHub(settings)
        request.app.state.sse_hub = hub
        await hub.start()
    return hub
