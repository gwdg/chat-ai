"""Pydantic models for the agentic job API."""

from __future__ import annotations

from enum import Enum
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


class JobState(str, Enum):
    """Simplified, caller-friendly state vocabulary (Task 1.3)."""

    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"
    UNKNOWN = "unknown"

    @property
    def is_terminal(self) -> bool:
        return self in {
            JobState.SUCCEEDED,
            JobState.FAILED,
            JobState.CANCELLED,
            JobState.TIMED_OUT,
        }


# Slurm -> simplified state map. Values are matched in upper-case.
SLURM_STATE_MAP: Dict[str, JobState] = {
    "PENDING": JobState.QUEUED,
    "CONFIGURING": JobState.QUEUED,
    "REQUEUED": JobState.QUEUED,
    "RESV_DEL_HOLD": JobState.QUEUED,
    "REQUEUE_FED": JobState.QUEUED,
    "REQUEUE_HOLD": JobState.QUEUED,
    "SUSPENDED": JobState.QUEUED,
    "RUNNING": JobState.RUNNING,
    "COMPLETING": JobState.RUNNING,
    "COMPLETED": JobState.SUCCEEDED,
    "FAILED": JobState.FAILED,
    "NODE_FAIL": JobState.FAILED,
    "BOOT_FAIL": JobState.FAILED,
    "DEADLINE": JobState.FAILED,
    "OUT_OF_MEMORY": JobState.FAILED,
    "CANCELLED": JobState.CANCELLED,
    "REVOKED": JobState.CANCELLED,
    "TIMEOUT": JobState.TIMED_OUT,
    "PREEMPTED": JobState.TIMED_OUT,
}


def map_slurm_state(slurm_state: Optional[str]) -> JobState:
    """Translate a slurmrestd ``job_state`` string to a JobState value."""
    if not slurm_state:
        return JobState.UNKNOWN
    return SLURM_STATE_MAP.get(slurm_state.upper(), JobState.UNKNOWN)


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobState
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    exit_code: Optional[int] = None


class CancelReason(str, Enum):
    """Why a cancellation was requested. Recorded in structured logs."""

    USER_STOP = "user_stop"
    TIMEOUT = "timeout"
    SESSION_END = "session_end"
    ADMIN_CANCEL = "admin_cancel"


class JobCancellationResponse(BaseModel):
    job_id: str
    status: JobState = JobState.CANCELLED
    reason: CancelReason = CancelReason.USER_STOP

