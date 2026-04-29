"""Pydantic models for the agentic Vault / secrets API (Task 1.5)."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SecretType(str, Enum):
    """Whitelisted secret types the broker is allowed to fetch.

    Limiting the surface area means a malicious or buggy agent cannot
    request arbitrary Vault paths just by varying the URL segment.
    """

    SEARCH_API_KEY = "search_api_key"
    GITHUB_PAT = "github_pat"
    OIDC_TOKEN = "oidc_token"


class SecretResponse(BaseModel):
    """Public shape of `GET /api/secrets/{secret_type}`.

    We deliberately do **not** echo the raw Vault metadata — only the
    minimum the agent runtime needs to use the secret and decide when
    to refresh it.
    """

    secret_type: SecretType
    value: str = Field(..., min_length=1)
    expires_at: Optional[str] = Field(
        default=None,
        description="ISO-8601 UTC timestamp when the secret will expire, "
        "or null if Vault did not advertise a TTL.",
    )
