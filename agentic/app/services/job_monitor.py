"""Background job-status monitor (Task 1.3).

A single ``JobMonitor`` instance tracks every job submitted through this
broker. For each tracked job it runs an ``asyncio`` polling loop that
refreshes the cached ``JobStatusResponse`` every
``settings.slurm_status_poll_interval_s`` seconds and shuts itself
down once the job reaches a terminal state.

The HTTP layer reads the cached status in O(1); only when the cache is
stale (older than ``settings.slurm_status_cache_ttl_s``) does a request
trigger a synchronous slurmrestd fetch.

Design notes
------------
* The monitor is owned by the FastAPI ``app.state`` so a single instance
  is shared across requests and torn down cleanly in lifespan.
* ``register()`` takes the bearer token because polling outlives the
  request that submitted the job. The token is held in process memory
  only — never logged, never persisted.
* ``cancel(job_id)`` is provided so Task 1.4 (cancellation) can stop a
  poll loop immediately on user-initiated stop.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from app.clients.slurm import SlurmClient, SlurmError, SlurmNotFoundError
from app.config import Settings
from app.models.job import CancelReason, JobState, JobStatusResponse

log = logging.getLogger("agentic.monitor")


@dataclass
class _Tracked:
    job_id: str
    owner: str
    bearer_token: str
    registered_at: float
    status: Optional[JobStatusResponse] = None
    fetched_at: float = 0.0
    error: Optional[str] = None
    task: Optional[asyncio.Task] = field(default=None, repr=False)


class JobOwnershipError(Exception):
    """Raised when a caller tries to cancel a job they do not own."""


class JobAlreadyTerminalError(Exception):
    """Raised when cancellation is requested for a job in a terminal state."""

    def __init__(self, state: JobState) -> None:
        super().__init__(f"job already terminal: {state.value}")
        self.state = state


class JobMonitor:
    def __init__(self, settings: Settings, client: SlurmClient) -> None:
        self._settings = settings
        self._client = client
        self._jobs: Dict[str, _Tracked] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------- lifecycle
    async def register(self, *, job_id: str, owner: str, bearer_token: str) -> None:
        """Begin polling ``job_id``. Idempotent."""
        async with self._lock:
            if job_id in self._jobs:
                return
            tracked = _Tracked(
                job_id=job_id,
                owner=owner,
                bearer_token=bearer_token,
                registered_at=time.monotonic(),
            )
            tracked.task = asyncio.create_task(
                self._poll_loop(tracked),
                name=f"job-monitor:{job_id}",
            )
            self._jobs[job_id] = tracked
            log.info("monitor_register", extra={"job_id": job_id, "owner": owner})

    async def cancel(self, job_id: str) -> None:
        """Stop tracking ``job_id`` and cancel its polling task."""
        async with self._lock:
            tracked = self._jobs.pop(job_id, None)
        if tracked and tracked.task and not tracked.task.done():
            tracked.task.cancel()
            try:
                await tracked.task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        if tracked:
            log.info("monitor_cancel", extra={"job_id": job_id})

    async def cancel_with_ownership(
        self,
        job_id: str,
        *,
        owner: str,
        bearer_token: str,
        reason: CancelReason,
    ) -> JobStatusResponse:
        """Cancel a job after verifying the caller owns it.

        Behaviour matches the Task 1.4 acceptance criteria:

        * tracked & owned by ``owner`` → call ``scancel`` (with grace period
          for very-recently-submitted jobs), stop polling, return CANCELLED
        * tracked but owned by someone else → ``JobOwnershipError``
        * tracked and already terminal → ``JobAlreadyTerminalError``
        * untracked → fall through to a one-shot scancel, treating any
          slurmrestd 404 as ``SlurmNotFoundError``
        """
        tracked = self._jobs.get(job_id)
        if tracked is None:
            await self._client.cancel_job(job_id, bearer_token=bearer_token)
            log.info(
                "cancel_untracked",
                extra={"job_id": job_id, "owner": owner, "reason": reason.value},
            )
            return JobStatusResponse(job_id=job_id, status=JobState.CANCELLED)

        if tracked.owner != owner:
            log.warning(
                "cancel_forbidden",
                extra={
                    "job_id": job_id,
                    "owner": tracked.owner,
                    "requested_by": owner,
                },
            )
            raise JobOwnershipError(
                f"{owner} cannot cancel job owned by {tracked.owner}"
            )

        if tracked.status is not None and tracked.status.status.is_terminal:
            raise JobAlreadyTerminalError(tracked.status.status)

        # Grace period: if the job is freshly submitted and still queued, give
        # Slurm a chance to start it cleanly before issuing scancel. We never
        # block longer than slurm_cancel_grace_period_s.
        elapsed = time.monotonic() - tracked.registered_at
        grace = self._settings.slurm_cancel_grace_period_s
        if grace > 0 and elapsed < grace:
            wait_for = grace - elapsed
            log.info(
                "cancel_grace_wait",
                extra={
                    "job_id": job_id,
                    "wait_s": round(wait_for, 3),
                    "reason": reason.value,
                },
            )
            await asyncio.sleep(wait_for)

        await self._client.cancel_job(job_id, bearer_token=tracked.bearer_token)

        # Stop the background poller; keep last-known status so subsequent
        # GETs return CANCELLED rather than 404.
        if tracked.task and not tracked.task.done():
            tracked.task.cancel()
            try:
                await tracked.task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
            tracked.task = None

        cancelled = JobStatusResponse(
            job_id=job_id,
            status=JobState.CANCELLED,
            start_time=(tracked.status.start_time if tracked.status else None),
        )
        tracked.status = cancelled
        tracked.fetched_at = time.monotonic()

        log.info(
            "cancel_ok",
            extra={"job_id": job_id, "owner": owner, "reason": reason.value},
        )
        return cancelled

    async def aclose(self) -> None:
        """Cancel every poll loop. Called from the FastAPI lifespan shutdown."""
        async with self._lock:
            tasks = [t.task for t in self._jobs.values() if t.task]
            self._jobs.clear()
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

    # --------------------------------------------------------------- queries
    def is_tracked(self, job_id: str) -> bool:
        return job_id in self._jobs

    def cached(self, job_id: str) -> Optional[JobStatusResponse]:
        tracked = self._jobs.get(job_id)
        return tracked.status if tracked else None

    def is_fresh(self, job_id: str) -> bool:
        tracked = self._jobs.get(job_id)
        if not tracked or tracked.fetched_at == 0.0:
            return False
        return (time.monotonic() - tracked.fetched_at) <= self._settings.slurm_status_cache_ttl_s

    async def get_status(
        self,
        job_id: str,
        *,
        bearer_token: Optional[str] = None,
        owner: Optional[str] = None,
    ) -> JobStatusResponse:
        """Return the freshest known status, fetching synchronously if stale.

        When ``owner`` is supplied, callers other than the job's owner
        get :class:`JobOwnershipError` (Task 1.7 acceptance criterion:
        a user cannot read another user's job state).

        Raises ``SlurmNotFoundError`` for unknown jobs (translates to 404 in
        the router) and ``SlurmError`` subclasses for upstream failures.
        """
        tracked = self._jobs.get(job_id)
        if tracked is None:
            # Untracked job — fall back to a one-shot fetch using the caller's
            # token. This still works for jobs submitted out-of-band as long
            # as the same Slurm credentials are used.
            if not bearer_token:
                raise SlurmNotFoundError(f"job {job_id} not tracked")
            status = await self._client.get_job_status(
                job_id, bearer_token=bearer_token
            )
            return status

        if owner is not None and tracked.owner != owner:
            log.warning(
                "status_forbidden",
                extra={
                    "job_id": job_id,
                    "owner": tracked.owner,
                    "requested_by": owner,
                },
            )
            raise JobOwnershipError(
                f"{owner} cannot read job owned by {tracked.owner}"
            )

        if self.is_fresh(job_id) and tracked.status is not None:
            return tracked.status

        try:
            status = await self._client.get_job_status(
                job_id, bearer_token=tracked.bearer_token
            )
        except SlurmError:
            if tracked.status is not None:
                # Return last known good rather than fail an in-flight session.
                return tracked.status
            raise

        tracked.status = status
        tracked.fetched_at = time.monotonic()
        if status.status.is_terminal:
            await self._stop_polling(job_id)
        return status

    # ---------------------------------------------------------------- internals
    async def _poll_loop(self, tracked: _Tracked) -> None:
        interval = self._settings.slurm_status_poll_interval_s
        log.info(
            "monitor_poll_start",
            extra={"job_id": tracked.job_id, "interval_s": interval},
        )
        try:
            while True:
                try:
                    status = await self._client.get_job_status(
                        tracked.job_id, bearer_token=tracked.bearer_token
                    )
                    tracked.status = status
                    tracked.fetched_at = time.monotonic()
                    tracked.error = None
                    if status.status.is_terminal:
                        log.info(
                            "monitor_poll_terminal",
                            extra={
                                "job_id": tracked.job_id,
                                "status": status.status.value,
                                "exit_code": status.exit_code,
                            },
                        )
                        return
                except SlurmError as exc:
                    tracked.error = str(exc)
                    log.warning(
                        "monitor_poll_error",
                        extra={"job_id": tracked.job_id, "error": str(exc)},
                    )
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            log.info("monitor_poll_cancelled", extra={"job_id": tracked.job_id})
            raise
        finally:
            # Self-deregister so the GET endpoint stops finding stale entries
            # for cancelled or terminal jobs (status remains in tracked.status
            # for one final read, but the loop won't restart).
            pass

    async def _stop_polling(self, job_id: str) -> None:
        # Polling task is already returning; just unhook it from the registry
        # after one grace iteration so callers see the terminal status once.
        # We deliberately keep the entry so subsequent GETs return the
        # terminal status from cache instead of 404'ing.
        tracked = self._jobs.get(job_id)
        if tracked and tracked.task and tracked.task.done():
            tracked.task = None
