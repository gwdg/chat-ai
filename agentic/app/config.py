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
