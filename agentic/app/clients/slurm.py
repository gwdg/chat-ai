"""Async Slurm REST API client (slurmrestd).

Design goals:

* Pluggable via FastAPI dependency injection so tests can inject either an
  ``httpx.MockTransport`` or a fully fake client.
* Strict error taxonomy so the HTTP router can map upstream failures to the
  4xx/5xx codes required by Task 1.2 (401, 403, 400, 503, 502).
* Mock mode (``settings.slurm_mock_mode=True``) returns a synthetic job id
  without reaching the network. This lets the broker run end-to-end on a
  developer VM with no Slurm installed, satisfying the "test without HPC"
  workflow.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

import httpx

from app.config import Settings
from app.models.job import (
    JobState,
    JobStatusResponse,
    JobSubmissionRequest,
    map_slurm_state,
)

log = logging.getLogger("agentic.slurm")


class SlurmError(Exception):
    """Base class for Slurm client errors mapped to HTTP responses."""

    http_status: int = 502

    def __init__(self, message: str, *, detail: Any = None) -> None:
        super().__init__(message)
        self.detail = detail


class SlurmAuthError(SlurmError):
    http_status = 401


class SlurmForbiddenError(SlurmError):
    http_status = 403


class SlurmBadRequestError(SlurmError):
    http_status = 400


class SlurmUnavailableError(SlurmError):
    http_status = 503


class SlurmNotFoundError(SlurmError):
    http_status = 404


@dataclass
class SubmitResult:
    job_id: str


class SlurmClient:
    """Thin async wrapper around the slurmrestd job-submit endpoint."""

    def __init__(
        self,
        settings: Settings,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._settings = settings
        self._client = http_client or httpx.AsyncClient(
            base_url=settings.slurm_base_url,
            timeout=httpx.Timeout(settings.slurm_request_timeout_s),
        )
        self._owns_client = http_client is None
        self._mock_status_bucket: Dict[str, int] = {}

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------ submit
    async def submit_job(
        self,
        req: JobSubmissionRequest,
        *,
        bearer_token: str,
    ) -> SubmitResult:
        """Submit a job to slurmrestd and return the job id.

        Raises one of the ``SlurmError`` subclasses on failure; the router
        translates these to the corresponding HTTP status.
        """
        if self._settings.slurm_mock_mode:
            mock_id = f"mock-{uuid.uuid4().hex[:12]}"
            self._mock_status_bucket[mock_id] = 0  # mark id as known
            log.info(
                "slurm_submit_mock",
                extra={"session_id": req.session_id, "job_id": mock_id},
            )
            return SubmitResult(job_id=mock_id)

        payload = self._build_payload(req)
        url = f"/slurm/{self._settings.slurm_api_version}/job/submit"
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        log.info(
            "slurm_submit_request",
            extra={
                "url": url,
                "session_id": req.session_id,
                "partition": payload["job"]["partition"],
                "time_limit_minutes": payload["job"]["time_limit"],
                "memory_mb": payload["job"]["memory_per_node"],
                "cpus": payload["job"]["cpus_per_task"],
                "container": payload["job"]["container"],
            },
        )

        response = await self._send_with_retries("POST", url, headers, payload)
        body = self._safe_json(response)

        log.info(
            "slurm_submit_response",
            extra={
                "status_code": response.status_code,
                "session_id": req.session_id,
                "errors": body.get("errors") if isinstance(body, dict) else None,
                "warnings": body.get("warnings") if isinstance(body, dict) else None,
            },
        )

        self._raise_for_status(response, body)

        job_id = self._extract_job_id(body)
        if job_id is None:
            raise SlurmError(
                "slurmrestd response missing job_id", detail=body
            )
        return SubmitResult(job_id=str(job_id))

    # ------------------------------------------------------------------ status
    async def get_job_status(
        self,
        job_id: str,
        *,
        bearer_token: str,
    ) -> JobStatusResponse:
        """Fetch the current status of a Slurm job.

        Mock mode walks a deterministic state machine
        (``queued`` → ``running`` → ``succeeded``) so the broker can be
        exercised on a developer VM with no Slurm running.
        """
        if self._settings.slurm_mock_mode:
            return self._mock_status(job_id)

        url = f"/slurm/{self._settings.slurm_api_version}/job/{job_id}"
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Accept": "application/json",
        }

        response = await self._send_with_retries("GET", url, headers, payload=None)
        body = self._safe_json(response)
        self._raise_for_status(response, body)

        return self._parse_status(job_id, body)

    # ------------------------------------------------------------- internals
    def _mock_status(self, job_id: str) -> JobStatusResponse:
        """Cycle a fake job through queued/running/succeeded based on call count.

        Unknown IDs raise ``SlurmNotFoundError`` so the broker can faithfully
        return 404 in mock mode (matching real slurmrestd behaviour).
        """
        bucket = self._mock_status_bucket
        if job_id not in bucket:
            raise SlurmNotFoundError(f"unknown mock job {job_id}")
        n = bucket[job_id]
        bucket[job_id] = n + 1
        if n == 0:
            return JobStatusResponse(job_id=job_id, status=JobState.QUEUED)
        if n == 1:
            return JobStatusResponse(
                job_id=job_id,
                status=JobState.RUNNING,
                start_time=_now_iso(),
            )
        return JobStatusResponse(
            job_id=job_id,
            status=JobState.SUCCEEDED,
            start_time=_now_iso(),
            end_time=_now_iso(),
            exit_code=0,
        )

    @staticmethod
    def _parse_status(job_id: str, body: Any) -> JobStatusResponse:
        if not isinstance(body, dict):
            raise SlurmError("slurmrestd returned non-object body", detail=body)

        # slurmrestd returns {"jobs": [ {...} ]} for /job/{id}
        jobs = body.get("jobs")
        if isinstance(jobs, list) and jobs:
            job = jobs[0]
        elif isinstance(body.get("job"), dict):
            job = body["job"]
        else:
            raise SlurmNotFoundError("no job in response", detail=body)

        # job_state can be a string or a list of strings, depending on version.
        raw_state = job.get("job_state")
        if isinstance(raw_state, list):
            raw_state = raw_state[0] if raw_state else None
        state = map_slurm_state(raw_state)

        exit_code = None
        ec = job.get("exit_code")
        if isinstance(ec, dict):
            # slurmrestd v0.0.40: {"status": ["SUCCESS"],
            # "return_code": {"set": true, "number": 0}}
            rc = ec.get("return_code")
            if isinstance(rc, dict):
                if rc.get("set"):
                    exit_code = rc.get("number")
            elif isinstance(rc, int):
                exit_code = rc
        elif isinstance(ec, int):
            exit_code = ec

        return JobStatusResponse(
            job_id=job_id,
            status=state,
            start_time=_epoch_to_iso(job.get("start_time")),
            end_time=_epoch_to_iso(job.get("end_time")),
            exit_code=exit_code,
        )
    def _build_payload(self, req: JobSubmissionRequest) -> Dict[str, Any]:
        s = self._settings
        env_map: Dict[str, str] = {
            # Force agent egress through the GWDG WWW-Cache proxy (FR-007).
            "HTTP_PROXY": "http://www-cache.gwdg.de:3128",
            "HTTPS_PROXY": "http://www-cache.gwdg.de:3128",
            "NO_PROXY": "localhost,127.0.0.1",
        }
        env_map.update(req.environment or {})
        # slurmrestd expects a list of "KEY=VALUE" strings.
        environment = [f"{k}={v}" for k, v in env_map.items()]

        job: Dict[str, Any] = {
            "name": f"agentic-{req.session_id}",
            "partition": req.partition or s.slurm_default_partition,
            "time_limit": req.time_limit_minutes or s.slurm_default_time_limit_minutes,
            "memory_per_node": req.memory_mb or s.slurm_default_memory_mb,
            "cpus_per_task": req.cpus or s.slurm_default_cpus,
            "container": req.container_image,
            "environment": environment,
            "standard_output": "/dev/null",
            "standard_error": "/dev/null",
        }
        if req.working_directory:
            job["current_working_directory"] = req.working_directory

        # slurmrestd requires `script` even when running a container. The
        # container runtime ignores it; we include a no-op for compatibility.
        return {"job": job, "script": "#!/bin/bash\nexec sleep infinity\n"}

    async def _send_with_retries(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        payload: Optional[Mapping[str, Any]] = None,
    ) -> httpx.Response:
        s = self._settings
        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt <= s.slurm_max_retries:
            try:
                kwargs: Dict[str, Any] = {"headers": headers}
                if payload is not None:
                    kwargs["json"] = payload
                response = await self._client.request(method, url, **kwargs)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                if attempt == s.slurm_max_retries:
                    raise SlurmUnavailableError(
                        f"slurmrestd unreachable: {exc!s}"
                    ) from exc
                await asyncio.sleep(s.slurm_retry_backoff_s * (2 ** attempt))
                attempt += 1
                continue

            # Retry transient 5xx but never 4xx; 5xx is mapped to "unavailable".
            if 500 <= response.status_code < 600 and attempt < s.slurm_max_retries:
                log.warning(
                    "slurm_transient_5xx",
                    extra={"status_code": response.status_code, "attempt": attempt},
                )
                await asyncio.sleep(s.slurm_retry_backoff_s * (2 ** attempt))
                attempt += 1
                continue

            return response

        # Should be unreachable, but be defensive.
        assert last_exc is not None
        raise SlurmUnavailableError(str(last_exc)) from last_exc

    @staticmethod
    def _safe_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    @staticmethod
    def _raise_for_status(response: httpx.Response, body: Any) -> None:
        sc = response.status_code
        if sc < 400:
            # Even 200 can carry application-level errors in body["errors"].
            if isinstance(body, dict) and body.get("errors"):
                raise SlurmBadRequestError(
                    "slurmrestd reported errors", detail=body["errors"]
                )
            return
        if sc == 401:
            raise SlurmAuthError("authentication failed", detail=body)
        if sc == 403:
            raise SlurmForbiddenError("authorization failed", detail=body)
        if sc == 400 or sc == 422:
            raise SlurmBadRequestError("invalid request", detail=body)
        if sc == 404:
            raise SlurmNotFoundError("not found", detail=body)
        if 500 <= sc < 600:
            raise SlurmUnavailableError("slurm service unavailable", detail=body)
        raise SlurmError(f"unexpected slurm status {sc}", detail=body)

    @staticmethod
    def _extract_job_id(body: Any) -> Optional[Any]:
        if not isinstance(body, dict):
            return None
        # slurmrestd 0.0.40+: top-level "job_id"
        if "job_id" in body and body["job_id"] is not None:
            return body["job_id"]
        # Older variants: {"result": {"job_id": ...}}
        result = body.get("result")
        if isinstance(result, dict) and result.get("job_id") is not None:
            return result["job_id"]
        return None


# Module-level helpers --------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _epoch_to_iso(value: Any) -> Optional[str]:
    """Best-effort convert slurm epoch / dict timestamps to ISO-8601.

    slurmrestd timestamps come as ``{"set": true, "number": 1714000000}`` in
    newer versions, or just an integer, or ``0`` when unset.
    """
    if value is None:
        return None
    if isinstance(value, dict):
        if not value.get("set"):
            return None
        value = value.get("number")
    try:
        epoch = int(value)
    except (TypeError, ValueError):
        return None
    if epoch <= 0:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
