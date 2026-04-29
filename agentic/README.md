# Agentic Layer — FastAPI Session Broker

Python microservice that brokers agentic sessions between the existing
Chat AI stack (`back/`, `front/`) and the GWDG HPC cluster (Slurm,
Vault, Apptainer-hosted MCP servers).

This package implements **Task 1.1: FastAPI Application Setup** of the
`001-agentic-layer` feature. Subsequent tasks add Slurm, Vault, and SSE
streaming endpoints on top of this scaffold.

## Layout

```
agentic/
├── app/
│   ├── main.py            # FastAPI factory, middleware, lifespan
│   ├── config.py          # Pydantic settings (env-driven)
│   ├── logging_config.py  # Structured JSON logging
│   └── routers/
│       └── health.py      # GET /health
├── tests/
│   └── test_health.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## Run locally (without Docker)

Requires Python 3.11+.

```bash
cd agentic
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Health check:

```bash
curl -i http://localhost:8001/health
# HTTP/1.1 200 OK
# {"status":"healthy","version":"0.1.0"}
```

## Run with Docker / docker-compose

The service is wired into the root `docker-compose.yml` as the
`agentic` service:

```bash
docker compose up --build agentic
```

## Configuration

All settings are loaded from environment variables prefixed with
`AGENTIC_`. Defaults are safe for local development.

| Variable | Default | Purpose |
|---|---|---|
| `AGENTIC_ENVIRONMENT` | `development` | `development` \| `staging` \| `production` |
| `AGENTIC_LOG_LEVEL` | `INFO` | Root log level |
| `AGENTIC_HOST` | `0.0.0.0` | Bind host |
| `AGENTIC_PORT` | `8001` | Bind port |
| `AGENTIC_CORS_ALLOW_ORIGINS` | `http://localhost:3000,http://localhost:5173` | CSV of allowed origins |
| `AGENTIC_RELOAD` | `false` | Enable uvicorn auto-reload (dev only) |

In production, set `AGENTIC_ENVIRONMENT=production` and explicitly pin
`AGENTIC_CORS_ALLOW_ORIGINS` to the deployed Node.js backend origin.

## Logging

All logs are emitted to stdout as single-line JSON, including
Uvicorn access logs. Each HTTP response carries an `X-Request-ID`
header (echoed from inbound or generated) that is also included in the
log record for correlation.

## Tests

```bash
cd agentic
pip install -r requirements.txt
pytest -q
```

The test suite covers the Task 1.1 acceptance criteria:

- `GET /health` returns `200 OK` with `{"status": "healthy", ...}`
- CORS preflight from an allowed origin returns the expected
  `access-control-allow-origin` header
- Every response carries an `X-Request-ID`

## Roadmap

| Task | Status |
|---|---|
| 1.1 FastAPI Setup | done (this PR) |
| 1.2 Slurm Job Submission | next |
| 1.3 Slurm Job Monitoring | pending |
| 1.4 Slurm Job Cancellation | pending |
| 1.5 Vault Secret Retrieval | pending |
| 1.6 SSE Streaming | pending |
| 1.7 X-User Auth Middleware | pending |
