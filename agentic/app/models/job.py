"""Pydantic models for the agentic job-submission API."""

from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field


class JobSubmissionRequest(BaseModel):
    """Caller-facing request payload for `POST /api/jobs`.

    The fields mirror the subset of the slurmrestd job spec we care about for
    spinning up an Apptainer-based agent workspace. Anything unset falls back
    to defaults from `Settings`.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Stable identifier for the agent session, used as job name.",
    )
    container_image: str = Field(
        ...,
        min_length=1,
        description="Absolute path to the Apptainer .sif image on the cluster.",
    )

    partition: Optional[str] = None
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=24 * 60)
    memory_mb: Optional[int] = Field(default=None, ge=128)
    cpus: Optional[int] = Field(default=None, ge=1, le=256)

    working_directory: Optional[str] = Field(
        default=None,
        description="Absolute path to use as the job's CWD (e.g. /tmp/workspace-<user>-<sid>).",
    )
    environment: Dict[str, str] = Field(
        default_factory=dict,
        description="Extra env vars merged with proxy/Vault defaults at submit time.",
    )


class JobSubmissionResponse(BaseModel):
    job_id: str
    status: str = "submitted"
