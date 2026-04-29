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
    # If true, return mock job ids without calling slurmrestd. Useful for VM
    # development before HPC integration is available.
    slurm_mock_mode: bool = Field(default=False)

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
