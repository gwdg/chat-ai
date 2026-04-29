"""FastAPI application factory for the agentic session broker."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import Settings, get_settings
from app.logging_config import configure_logging
from app.routers import health, jobs, secrets, sse


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    log = logging.getLogger(settings.app_name)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        log.info(
            "agentic broker starting",
            extra={
                "environment": settings.environment,
                "version": __version__,
                "slurm_mock_mode": settings.slurm_mock_mode,
            },
        )
        yield
        monitor = getattr(app.state, "job_monitor", None)
        if monitor is not None:
            await monitor.aclose()
        client = getattr(app.state, "slurm_client", None)
        if client is not None:
            await client.aclose()
        vault = getattr(app.state, "vault_client", None)
        if vault is not None:
            await vault.aclose()
        sse_hub = getattr(app.state, "sse_hub", None)
        if sse_hub is not None:
            await sse_hub.aclose()
        log.info("agentic broker stopping")

    app = FastAPI(
        title="Agentic Layer Session Broker",
        version=__version__,
        description="FastAPI broker for the Chat AI agentic layer (Slurm + Vault + SSE).",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_logging(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex)
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        log.info(
            "http_request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "client": request.client.host if request.client else None,
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response

    app.include_router(health.router)
    app.include_router(jobs.router)
    app.include_router(secrets.router)
    app.include_router(sse.router)
    return app


app = create_app()
