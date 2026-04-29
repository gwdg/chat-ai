# Agentic Layer — FastAPI Session Broker

Python microservice that brokers agentic sessions between the existing
Chat AI stack (`back/`, `front/`) and the GWDG HPC cluster (Slurm,
Vault, Apptainer-hosted MCP servers).

This package currently implements:

- **Task 1.1**: FastAPI Application Setup
- **Task 1.2**: Slurm Job Submission (`POST /api/jobs`, mock-mode supported)
- **Task 1.3**: Slurm Job Monitoring (`GET /api/jobs/{job_id}/status`, background
  poller, simplified state vocabulary, 1s cache)

Subsequent tasks add Slurm cancellation, Vault, and SSE streaming
endpoints.

## Layout

```
agentic/
├── app/
│   ├── main.py             # FastAPI factory, middleware, lifespan
│   ├── config.py           # Pydantic settings (env-driven)
│   ├── logging_config.py   # Structured JSON logging
│   ├── dependencies.py     # Auth-header parsers, Slurm client + monitor providers
│   ├── clients/
│   │   └── slurm.py        # Async slurmrestd client (httpx, retries, status)
│   ├── models/
│   │   └── job.py          # Schemas + Slurm->JobState mapping
│   ├── services/
│   │   └── job_monitor.py  # Background poller, status cache, registry
│   └── routers/
│       ├── health.py       # GET /health
│       └── jobs.py         # POST /api/jobs, GET /api/jobs/{id}/status
├── tests/
│   ├── test_health.py
│   ├── test_jobs.py        # submission paths
│   └── test_status.py      # monitoring paths (mocks slurmrestd)
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
| `AGENTIC_SLURM_BASE_URL` | `http://localhost:6820` | slurmrestd base URL |
| `AGENTIC_SLURM_API_VERSION` | `v0.0.40` | slurmrestd API version segment |
| `AGENTIC_SLURM_DEFAULT_PARTITION` | `grete:interactive` | Default Slurm partition |
| `AGENTIC_SLURM_DEFAULT_TIME_LIMIT_MINUTES` | `30` | Default job time limit |
| `AGENTIC_SLURM_DEFAULT_MEMORY_MB` | `16384` | Default memory request |
| `AGENTIC_SLURM_DEFAULT_CPUS` | `4` | Default CPU count |
| `AGENTIC_SLURM_REQUEST_TIMEOUT_S` | `30` | Per-call HTTP timeout |
| `AGENTIC_SLURM_MAX_RETRIES` | `3` | Retries on transport / 5xx |
| `AGENTIC_SLURM_RETRY_BACKOFF_S` | `0.5` | Exponential backoff base |
| `AGENTIC_SLURM_STATUS_POLL_INTERVAL_S` | `2.0` | Background poll cadence per job |
| `AGENTIC_SLURM_STATUS_CACHE_TTL_S` | `1.0` | How long a status read is served from cache before re-fetching |
| `AGENTIC_SLURM_MOCK_MODE` | `false` | Return synthetic `mock-…` job ids without contacting Slurm. **Use this on a dev VM with no HPC access.** Also walks status through `queued → running → succeeded`. |

In production, set `AGENTIC_ENVIRONMENT=production` and explicitly pin
`AGENTIC_CORS_ALLOW_ORIGINS` to the deployed Node.js backend origin.

## API

### `POST /api/jobs`

Submits an Apptainer-based agent workspace as a Slurm job.

**Headers**

| Header | Required | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | yes | OIDC token forwarded to slurmrestd |
| `X-User: <username>` | yes | User identity from Kong auth stack |

**Request body**

```json
{
  "session_id": "sess-001",
  "container_image": "/cluster/images/agent.sif",
  "partition": "grete:interactive",
  "time_limit_minutes": 30,
  "memory_mb": 16384,
  "cpus": 4,
  "working_directory": "/tmp/workspace-alice-sess-001",
  "environment": {"VAULT_TOKEN": "..."}
}
```

Only `session_id` and `container_image` are required; everything else
falls back to `AGENTIC_SLURM_DEFAULT_*`. Proxy environment variables
(`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) are added automatically per
**FR-007**.

**Responses**

| Status | When | Body |
|---|---|---|
| 200 | submitted | `{"job_id":"<id>","status":"submitted"}` |
| 400 | slurmrestd rejected (incl. application errors in 200 body) | `{"detail":"..."}` |
| 401 | missing/invalid `Authorization` or `X-User`, or slurm 401 | `{"detail":"..."}` |
| 403 | slurmrestd 403 | `{"detail":"..."}` |
| 422 | invalid request payload | FastAPI validation error |
| 503 | slurmrestd unreachable / 5xx after retries | `{"detail":"..."}` |

On success the broker registers the job with the in-process
**JobMonitor**, which begins polling slurmrestd every
`AGENTIC_SLURM_STATUS_POLL_INTERVAL_S` seconds. Polling self-cancels as
soon as the job reaches a terminal state.

### `GET /api/jobs/{job_id}/status`

Reads the current job status. Served from cache when fresher than
`AGENTIC_SLURM_STATUS_CACHE_TTL_S`, otherwise re-fetched from slurmrestd
with the token captured at submit time.

**Headers**: same `Authorization` + `X-User` as above.

**Response** (`200 OK`):

```json
{
  "job_id": "12345",
  "status": "queued | running | succeeded | failed | cancelled | timed_out | unknown",
  "start_time": "2026-04-28T16:45:47+00:00",
  "end_time": null,
  "exit_code": null
}
```

**Status mapping** (Slurm → simplified):

| Slurm state(s) | Simplified |
|---|---|
| `PENDING`, `CONFIGURING`, `REQUEUED`, `SUSPENDED`, … | `queued` |
| `RUNNING`, `COMPLETING` | `running` |
| `COMPLETED` | `succeeded` |
| `FAILED`, `NODE_FAIL`, `BOOT_FAIL`, `OUT_OF_MEMORY`, `DEADLINE` | `failed` |
| `CANCELLED`, `REVOKED` | `cancelled` |
| `TIMEOUT`, `PREEMPTED` | `timed_out` |
| anything else | `unknown` |

**Errors**

| Status | When |
|---|---|
| 401 | missing `Authorization` / `X-User` |
| 404 | job id not tracked **and** slurmrestd reports not-found |
| 502 | slurmrestd error not mapped above |

### Local end-to-end test without HPC

```bash
AGENTIC_SLURM_MOCK_MODE=true \
AGENTIC_SLURM_STATUS_POLL_INTERVAL_S=0.5 \
AGENTIC_SLURM_STATUS_CACHE_TTL_S=0.2 \
  uvicorn app.main:app --port 8001 &

JOB=$(curl -sS http://localhost:8001/api/jobs \
  -H "Authorization: Bearer dev" -H "X-User: alice" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"sess-001","container_image":"/cluster/images/agent.sif"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')

curl -sS http://localhost:8001/api/jobs/$JOB/status \
  -H "Authorization: Bearer dev" -H "X-User: alice"
# {"job_id":"mock-...","status":"queued",...}

sleep 1
curl -sS http://localhost:8001/api/jobs/$JOB/status \
  -H "Authorization: Bearer dev" -H "X-User: alice"
# {"job_id":"mock-...","status":"succeeded","exit_code":0,...}
```

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

The test suite covers Tasks 1.1, 1.2, and 1.3 acceptance criteria:

- `GET /health` returns `200 OK` with `{"status":"healthy",...}`
- CORS preflight from an allowed origin returns
  `access-control-allow-origin`
- Every response carries an `X-Request-ID`
- `POST /api/jobs` happy path returns `{"job_id","status":"submitted"}`,
  forwards the Bearer token, and includes partition / container / proxy
  env in the slurmrestd payload
- Slurm 400/401/403/5xx and transport errors map to 400/401/403/503
- Transient 5xx is retried up to `AGENTIC_SLURM_MAX_RETRIES`
- `AGENTIC_SLURM_MOCK_MODE=true` short-circuits without any network call
- Slurm-state mapping table is exhaustive (PENDING, RUNNING, COMPLETED,
  FAILED, OUT_OF_MEMORY, CANCELLED, TIMEOUT, …)
- `GET /api/jobs/{id}/status` returns the simplified state, populated
  start/end timestamps, and exit code
- 404 for unknown job id, 502 for upstream Slurm errors
- Background poller actually runs and stops at terminal state
- Status reads within `cache_ttl_s` of the last fetch are served from
  cache (no re-fetch)

## Roadmap

| Task | Status |
|---|---|
| 1.1 FastAPI Setup | done |
| 1.2 Slurm Job Submission | done (mock-mode supported) |
| 1.3 Slurm Job Monitoring | done (mock-mode walks state machine) |
| 1.4 Slurm Job Cancellation | next |
| 1.4 Slurm Job Cancellation | pending |
| 1.5 Vault Secret Retrieval | pending |
| 1.6 SSE Streaming | pending |
| 1.7 X-User Auth Middleware | pending |
