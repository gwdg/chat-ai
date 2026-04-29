"""Job submission and status endpoints (Tasks 1.2 + 1.3)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.clients.slurm import (
    SlurmClient,
    SlurmError,
    SlurmNotFoundError,
)
from app.dependencies import (
    get_bearer_token,
    get_job_monitor,
    get_slurm_client,
    get_user_id,
)
from app.models.job import (
    CancelReason,
    JobCancellationResponse,
    JobStatusResponse,
    JobSubmissionRequest,
    JobSubmissionResponse,
)
from app.services.job_monitor import (
    JobAlreadyTerminalError,
    JobMonitor,
    JobOwnershipError,
)

log = logging.getLogger("agentic.jobs")

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post(
    "",
    response_model=JobSubmissionResponse,
    status_code=200,
    responses={
        400: {"description": "Invalid request"},
        401: {"description": "Authentication failed"},
        403: {"description": "Authorization failed"},
        503: {"description": "Slurm unavailable"},
        502: {"description": "Upstream Slurm error"},
    },
)
async def submit_job(
    req: JobSubmissionRequest,
    user_id: str = Depends(get_user_id),
    bearer_token: str = Depends(get_bearer_token),
    slurm: SlurmClient = Depends(get_slurm_client),
    monitor: JobMonitor = Depends(get_job_monitor),
) -> JobSubmissionResponse:
    log.info(
        "job_submit_received",
        extra={
            "user_id": user_id,
            "session_id": req.session_id,
            "container_image": req.container_image,
        },
    )
    try:
        result = await slurm.submit_job(req, bearer_token=bearer_token)
    except SlurmError as exc:
        log.warning(
            "job_submit_upstream_error",
            extra={
                "user_id": user_id,
                "session_id": req.session_id,
                "status": exc.http_status,
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=exc.http_status, detail=str(exc)) from exc

    await monitor.register(
        job_id=result.job_id, owner=user_id, bearer_token=bearer_token
    )

    log.info(
        "job_submit_ok",
        extra={
            "user_id": user_id,
            "session_id": req.session_id,
            "job_id": result.job_id,
        },
    )
    return JobSubmissionResponse(job_id=result.job_id, status="submitted")


@router.get(
    "/{job_id}/status",
    response_model=JobStatusResponse,
    responses={
        404: {"description": "Job not found"},
        502: {"description": "Upstream Slurm error"},
    },
)
async def get_job_status(
    job_id: str,
    user_id: str = Depends(get_user_id),
    bearer_token: str = Depends(get_bearer_token),
    monitor: JobMonitor = Depends(get_job_monitor),
) -> JobStatusResponse:
    try:
        status = await monitor.get_status(job_id, bearer_token=bearer_token)
    except SlurmNotFoundError as exc:
        log.info(
            "job_status_not_found",
            extra={"user_id": user_id, "job_id": job_id},
        )
        raise HTTPException(status_code=404, detail="job not found") from exc
    except SlurmError as exc:
        log.warning(
            "job_status_upstream_error",
            extra={"user_id": user_id, "job_id": job_id, "error": str(exc)},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    log.info(
        "job_status_ok",
        extra={
            "user_id": user_id,
            "job_id": job_id,
            "status": status.status.value,
        },
    )
    return status


@router.delete(
    "/{job_id}",
    response_model=JobCancellationResponse,
    responses={
        401: {"description": "Authentication failed"},
        403: {"description": "Caller does not own the job"},
        404: {"description": "Job not found"},
        409: {"description": "Job already in a terminal state"},
        502: {"description": "Upstream Slurm error"},
    },
)
async def cancel_job(
    job_id: str,
    reason: CancelReason = Query(
        default=CancelReason.USER_STOP,
        description="Why the cancellation was requested. Recorded in audit logs.",
    ),
    user_id: str = Depends(get_user_id),
    bearer_token: str = Depends(get_bearer_token),
    monitor: JobMonitor = Depends(get_job_monitor),
) -> JobCancellationResponse:
    log.info(
        "job_cancel_received",
        extra={"user_id": user_id, "job_id": job_id, "reason": reason.value},
    )
    try:
        await monitor.cancel_with_ownership(
            job_id,
            owner=user_id,
            bearer_token=bearer_token,
            reason=reason,
        )
    except JobOwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except JobAlreadyTerminalError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SlurmNotFoundError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc
    except SlurmError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return JobCancellationResponse(job_id=job_id, reason=reason)
