"""Reusable FastAPI dependencies.

Centralises auth-header parsing and Slurm-client construction so individual
routers stay slim and tests can override them via ``app.dependency_overrides``.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status

from app.clients.slurm import SlurmClient
from app.config import Settings, get_settings


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


def get_user_id(x_user: Optional[str] = Header(default=None, alias="X-User")) -> str:
    """Extract the X-User header set by the Kong auth stack (FR-002)."""
    if not x_user or not x_user.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User header",
        )
    return x_user.strip()


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
