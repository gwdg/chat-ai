"""Job-submission endpoints (Task 1.2)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.clients.slurm import SlurmClient, SlurmError
from app.dependencies import get_bearer_token, get_slurm_client, get_user_id
from app.models.job import JobSubmissionRequest, JobSubmissionResponse

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

    log.info(
        "job_submit_ok",
        extra={
            "user_id": user_id,
            "session_id": req.session_id,
            "job_id": result.job_id,
        },
    )
    return JobSubmissionResponse(job_id=result.job_id, status="submitted")
