"""Runtime configuration loaded from environment variables.

Configuration is intentionally environment-first so the same image runs in
local dev, CI, and production with no code changes.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AGENTIC_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "agentic-broker"
    environment: str = Field(default="development", description="development|staging|production")
    log_level: str = Field(default="INFO")

    host: str = "0.0.0.0"
    port: int = 8001
    reload: bool = False

    cors_allow_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )

    # --- Slurm ---------------------------------------------------------------
    slurm_base_url: str = Field(
        default="http://localhost:6820",
        description="Base URL of slurmrestd, e.g. http://slurmrestd.gwdg.de:6820",
    )
    slurm_api_version: str = Field(default="v0.0.40")
    slurm_default_partition: str = Field(default="grete:interactive")
    slurm_default_time_limit_minutes: int = Field(default=30, ge=1, le=24 * 60)
    slurm_default_memory_mb: int = Field(default=16 * 1024, ge=128)
    slurm_default_cpus: int = Field(default=4, ge=1, le=256)
    slurm_request_timeout_s: float = Field(default=30.0, gt=0)
    slurm_max_retries: int = Field(default=3, ge=0, le=10)
    slurm_retry_backoff_s: float = Field(
        default=0.5,
        ge=0,
        description="Base backoff for exponential retry (0.5, 1, 2, ...).",
    )
    slurm_status_poll_interval_s: float = Field(
        default=2.0,
        gt=0,
        description="How often the background monitor refreshes job status.",
    )
    slurm_status_cache_ttl_s: float = Field(
        default=1.0,
        ge=0,
        description="Age threshold for serving GET /api/jobs/{id}/status from cache.",
    )
    slurm_cancel_grace_period_s: float = Field(
        default=5.0,
        ge=0,
        description="If a queued job is younger than this many seconds, wait "
        "for it to start before issuing the cancel.",
    )
    # If true, return mock job ids without calling slurmrestd. Useful for VM
    # development before HPC integration is available.
    slurm_mock_mode: bool = Field(default=False)

    # --- Vault ---------------------------------------------------------------
    vault_base_url: str = Field(
        default="http://localhost:8200",
        description="Base URL of the HashiCorp Vault HTTP API.",
    )
    vault_token: str = Field(
        default="",
        description="Static Vault token used by the broker. In production "
        "this comes from AppRole / Kubernetes auth at boot time; here we "
        "allow a static value for dev simplicity.",
    )
    vault_namespace: str = Field(
        default="",
        description="Optional Vault Enterprise namespace (X-Vault-Namespace).",
    )
    vault_kv_mount: str = Field(
        default="kv",
        description="Mount path of the KV-v2 engine. Used to build "
        "/v1/<mount>/data/<path> URLs.",
    )
    vault_path_template: str = Field(
        default="users/{user_id}/secrets/{secret_type}",
        description="Pattern of secret paths inside the KV mount. "
        "Available substitutions: {user_id}, {secret_type}, {tenant_id}. "
        "If the X-User header carries a tenant suffix (`alice@gwdg`), "
        "tenant_id is the part after `@`; otherwise it's empty.",
    )
    vault_request_timeout_s: float = Field(default=10.0, gt=0)
    vault_max_retries: int = Field(default=2, ge=0, le=10)
    vault_retry_backoff_s: float = Field(default=0.25, ge=0)
    vault_cache_ttl_s: float = Field(
        default=60.0,
        ge=0,
        description="In-process cache TTL per (user_id, secret_type) entry. "
        "Reduces Vault QPS by >90% under typical agent workloads.",
    )
    # If true, return synthetic secrets without contacting Vault. Useful
    # for VM-only dev before Vault integration is wired up.
    vault_mock_mode: bool = Field(default=False)

    # --- SSE -----------------------------------------------------------------
    sse_heartbeat_interval_s: float = Field(
        default=15.0,
        gt=0,
        description="Cadence of SSE keepalive comments. Detects dead "
        "connections without polluting the event stream.",
    )
    sse_subscriber_queue_size: int = Field(
        default=256,
        ge=2,
        description="Per-subscriber bounded queue. Slow consumers are "
        "dropped (rather than back-pressuring publishers) once full.",
    )
    sse_publish_rate_per_session: int = Field(
        default=100,
        ge=1,
        description="Max publishes per session per second (Task 1.6 "
        "acceptance criterion). Excess returns 429.",
    )
    sse_session_idle_timeout_s: float = Field(
        default=300.0,
        gt=0,
        description="Sessions with no subscribers and no publishes for "
        "this many seconds are evicted by the background reaper.",
    )
    sse_reaper_interval_s: float = Field(
        default=30.0,
        gt=0,
        description="How often the idle-session reaper runs.",
    )

    # --- Auth (Task 1.7) ----------------------------------------------------
    auth_middleware_enabled: bool = Field(
        default=True,
        description="If True, install the X-User auth middleware that "
        "validates format, tracks sessions, and rate-limits per user. "
        "Set to False in tests that exercise individual dependencies.",
    )
    auth_validate_format: bool = Field(
        default=True,
        description="If True, X-User must match '<user>@<tenant>' "
        "(letters/digits/dot/hyphen/underscore on each side). When "
        "False the header is still required but its shape is not "
        "checked.",
    )
    auth_session_ttl_s: float = Field(
        default=30 * 60,
        gt=0,
        description="Idle-timeout for per-user sessions. Subsequent "
        "requests after this window return 401.",
    )
    auth_rate_per_user: int = Field(
        default=10,
        ge=1,
        description="Max requests per user per window. Excess returns "
        "429 Too Many Requests.",
    )
    auth_rate_window_s: float = Field(
        default=1.0,
        gt=0,
        description="Width of the sliding window for the per-user "
        "rate limit (1 second matches the spec).",
    )
    auth_skip_paths: List[str] = Field(
        default_factory=lambda: [
            "/health",
            "/openapi.json",
            "/docs",
            "/redoc",
            "/docs/oauth2-redirect",
        ],
        description="HTTP paths the middleware should ignore "
        "(infrastructure / docs).",
    )

    @field_validator("auth_skip_paths", mode="before")
    @classmethod
    def _split_csv_skip(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_csv(cls, v):
        # Allow CSV form via env var, e.g. AGENTIC_CORS_ALLOW_ORIGINS="http://a,http://b"
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
