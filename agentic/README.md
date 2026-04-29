# Agentic Layer — FastAPI Session Broker

Python microservice that brokers agentic sessions between the existing
Chat AI stack (`back/`, `front/`) and the GWDG HPC cluster (Slurm,
Vault, Apptainer-hosted MCP servers).

This package currently implements:

- **Task 1.1**: FastAPI Application Setup
- **Task 1.2**: Slurm Job Submission (`POST /api/jobs`, mock-mode supported)
- **Task 1.3**: Slurm Job Monitoring (`GET /api/jobs/{job_id}/status`, background
  poller, simplified state vocabulary, 1s cache)
- **Task 1.4**: Slurm Job Cancellation (`DELETE /api/jobs/{job_id}`, ownership
  check, grace period, structured cancel reason)
- **Task 1.5**: Vault Secret Retrieval (`GET /api/secrets/{secret_type}`,
  mock-mode supported, async KV-v2 client, in-process TTL cache,
  410 Gone for expired leases)
- **Task 1.6**: SSE Streaming (`GET /api/sse/{session_id}`,
  `POST /api/sse/{session_id}/events`, broadcast hub, 15s heartbeat,
  per-session 100 msg/s rate limit with 429, idle-session reaper)
- **Task 1.7**: X-User Auth Middleware (`<user>@<tenant>` format
  validation, 30-min session idle timeout, per-user 10 req/s sliding-
  window rate limit, cross-user 403 for SSE sessions and Slurm jobs)

## Layout

```
agentic/
├── app/
│   ├── main.py             # FastAPI factory, CORS, auth middleware, lifespan
│   ├── config.py           # Pydantic settings (Slurm, Vault, SSE, auth)
│   ├── logging_config.py   # Structured JSON logging
│   ├── dependencies.py     # Bearer / X-User, Slurm, Vault, SSE hub DI
│   ├── middleware/
│   │   └── auth.py         # X-User validation, session TTL, rate limit
│   ├── clients/
│   │   ├── slurm.py        # Async slurmrestd client (httpx, retries)
│   │   └── vault.py        # Async Vault KV-v2 reads (httpx, retries)
│   ├── models/
│   │   ├── job.py          # Job schemas + Slurm→JobState mapping
│   │   ├── secret.py       # Secret types + GET /api/secrets response
│   │   └── sse.py          # SSE publish/subscribe payloads
│   ├── services/
│   │   ├── job_monitor.py  # Background poller, status cache
│   │   ├── secret_cache.py # Per-(user,type) TTL cache in front of Vault
│   │   ├── sse_hub.py      # SSE sessions, broadcast, heartbeat, reaper
│   │   └── auth.py         # X-User parsing, sliding-window rate limit
│   └── routers/
│       ├── health.py       # GET /health
│       ├── jobs.py         # POST/GET/DELETE /api/jobs…
│       ├── secrets.py      # GET /api/secrets/{secret_type}
│       └── sse.py          # GET /api/sse/{session_id}, POST …/events
├── tests/
│   ├── test_health.py
│   ├── test_jobs.py
│   ├── test_status.py
│   ├── test_cancel.py
│   ├── test_secrets.py
│   ├── test_sse.py
│   └── test_auth.py
├── requirements.txt
├── Dockerfile
├── pytest.ini
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
| `AGENTIC_SLURM_CANCEL_GRACE_PERIOD_S` | `5.0` | If a queued job is younger than this, wait for it to start before issuing scancel. |
| `AGENTIC_SLURM_MOCK_MODE` | `false` | Return synthetic `mock-…` job ids without contacting Slurm. **Use this on a dev VM with no HPC access.** Walks status through `queued → running → succeeded` (or stays `cancelled` after a DELETE). |
| `AGENTIC_VAULT_BASE_URL` | `http://localhost:8200` | Vault HTTP API base URL |
| `AGENTIC_VAULT_TOKEN` | *(unset)* | Static token used by the broker. In production, populate from AppRole / Kubernetes auth at boot. |
| `AGENTIC_VAULT_NAMESPACE` | *(unset)* | Optional Vault Enterprise namespace |
| `AGENTIC_VAULT_KV_MOUNT` | `kv` | KV-v2 mount path |
| `AGENTIC_VAULT_PATH_TEMPLATE` | `users/{user_id}/secrets/{secret_type}` | Secret path template. Available substitutions: `{user_id}`, `{tenant_id}`, `{secret_type}`. `tenant_id` is the part of `X-User` after `@` (empty if no `@`). |
| `AGENTIC_VAULT_REQUEST_TIMEOUT_S` | `10` | Per-call HTTP timeout |
| `AGENTIC_VAULT_MAX_RETRIES` | `2` | Retries on transport / 5xx |
| `AGENTIC_VAULT_RETRY_BACKOFF_S` | `0.25` | Exponential backoff base |
| `AGENTIC_VAULT_CACHE_TTL_S` | `60` | In-process cache TTL per `(user_id, secret_type)` entry |
| `AGENTIC_VAULT_MOCK_MODE` | `false` | Return synthetic secrets without contacting Vault. Sentinel users `expired@…` → 410, `missing@…` → 404. |
| `AGENTIC_SSE_HEARTBEAT_INTERVAL_S` | `15` | Cadence of `: keepalive` SSE comments |
| `AGENTIC_SSE_SUBSCRIBER_QUEUE_SIZE` | `256` | Per-subscriber queue depth; slow consumers are dropped (with a structured warning) once full |
| `AGENTIC_SSE_PUBLISH_RATE_PER_SESSION` | `100` | Sliding-window publish rate limit per session (msg/s). Exceeded → 429 |
| `AGENTIC_SSE_SESSION_IDLE_TIMEOUT_S` | `300` | Empty rooms with no recent publishes are evicted by the reaper after this long |
| `AGENTIC_SSE_REAPER_INTERVAL_S` | `30` | Cadence of the idle-session reaper |
| `AGENTIC_AUTH_MIDDLEWARE_ENABLED` | `true` | Install the X-User auth middleware in front of every `/api/*` route |
| `AGENTIC_AUTH_VALIDATE_FORMAT` | `true` | Reject X-User values that do not match `<user>@<tenant>` (letters / digits / `.`, `-`, `_`, max 64 chars on each side) |
| `AGENTIC_AUTH_SESSION_TTL_S` | `1800` | Idle-timeout for a per-user session. Subsequent requests after this window return 401. |
| `AGENTIC_AUTH_RATE_PER_USER` | `10` | Per-user request budget within `AGENTIC_AUTH_RATE_WINDOW_S`. Excess returns 429 with `Retry-After: 1`. |
| `AGENTIC_AUTH_RATE_WINDOW_S` | `1.0` | Width of the per-user sliding-window rate limit |
| `AGENTIC_AUTH_SKIP_PATHS` | `/health,/openapi.json,/docs,/redoc,/docs/oauth2-redirect` | Paths that bypass the auth middleware (CSV) |

In production, set `AGENTIC_ENVIRONMENT=production` and explicitly pin
`AGENTIC_CORS_ALLOW_ORIGINS` to the deployed Node.js backend origin.

## API

### `POST /api/jobs`

Submits an Apptainer-based agent workspace as a Slurm job.

**Headers**

| Header | Required | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | yes | OIDC token forwarded to slurmrestd |
| `X-User: <user>@<tenant>` | yes | User identity from Kong auth stack |

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

### `DELETE /api/jobs/{job_id}?reason=<reason>`

Cancels a tracked Slurm job (`scancel` equivalent). The caller must own
the job (its `X-User` at submission time must match the current
`X-User`). The optional `reason` query param is one of:

- `user_stop` (default) — user clicked the Stop button
- `timeout` — broker-internal inactivity timeout
- `session_end` — browser disconnected / session closed
- `admin_cancel` — administrator-initiated termination

If the job is freshly submitted and still queued, the broker waits up
to `AGENTIC_SLURM_CANCEL_GRACE_PERIOD_S` seconds for Slurm to start it
cleanly before issuing the cancel.

**Response** (`200 OK`):

```json
{ "job_id": "12345", "status": "cancelled", "reason": "user_stop" }
```

**Errors**

| Status | When |
|---|---|
| 401 | missing `Authorization` / `X-User` |
| 403 | `X-User` does not own the job |
| 404 | job id unknown to broker **and** slurmrestd 404 |
| 409 | job already in a terminal state (`succeeded`, `failed`, `cancelled`, `timed_out`) |
| 422 | invalid `reason` |
| 502 | slurmrestd error |

### `GET /api/secrets/{secret_type}`

Reads a short-lived credential for the authenticated caller from Vault.
Allowed `secret_type` values: `search_api_key`, `github_pat`,
`oidc_token`. Anything else is rejected with `422`.

**Headers**: `X-User: <username>` (Bearer token is **not** required —
the broker uses its own configured Vault token).

**Response** (`200 OK`):

```json
{
  "secret_type": "search_api_key",
  "value": "<credential>",
  "expires_at": "2026-04-28T17:00:00+00:00"
}
```

`expires_at` is `null` when Vault did not advertise a TTL.

**Errors**

| Status | When |
|---|---|
| 401 | missing `X-User` |
| 404 | secret not found in Vault |
| 410 | secret found but its lease is in the past |
| 422 | unknown `secret_type` |
| 502 | Vault unavailable, auth misconfigured, or other Vault error |

The secret value is **never** logged. Only structured presence /
absence / TTL fields are emitted. Repeated reads are served from a
60-second in-process TTL cache (configurable via
`AGENTIC_VAULT_CACHE_TTL_S`).

### `GET /api/sse/{session_id}`  &nbsp;·&nbsp;  `POST /api/sse/{session_id}/events`

Server-Sent Events surface for streaming agent actions / results /
errors back to the browser in real time.

**Subscribe (browser side):**

```bash
curl -N -H "X-User: alice@gwdg" http://localhost:8001/api/sse/sess-001
# : connected
#
# event: action
# id: evt-1
# data: {"type":"web_search","message":"Searching..."}
#
# : keepalive
```

The first chunk is always a `: connected` comment, then each event
follows the SSE wire format. A `: keepalive` comment is emitted every
`AGENTIC_SSE_HEARTBEAT_INTERVAL_S` seconds so HTTP proxies do not idle-
close the connection. Multiple subscribers may join the same
`session_id` (broadcast); reconnecting with the same id rejoins the
existing room.

**Publish (agent side, runs inside the Apptainer container):**

```bash
curl -X POST http://localhost:8001/api/sse/sess-001/events \
  -H "X-User: alice@gwdg" -H "Content-Type: application/json" \
  -d '{"event":"action","data":{"type":"web_search","message":"Searching..."},"id":"evt-1"}'
# {"session_id":"sess-001","delivered_to":1,"queued":true}
```

`event` must be one of `action`, `result`, `error`, `message`. `data`
is an arbitrary JSON object. `id` is optional but recommended for
client-side `Last-Event-ID` reconnection bookkeeping.

**Errors**

| Status | When |
|---|---|
| 401 | missing `X-User` |
| 422 | unknown `event` |
| 429 | publish rate limit exceeded (`AGENTIC_SSE_PUBLISH_RATE_PER_SESSION` over 1s sliding window). Carries `Retry-After: 1` |

Slow subscribers are dropped (per-event) once their bounded queue is
full so a stuck client cannot back-pressure the publisher. A structured
`sse_publish_dropped_slow_subscriber` warning is emitted for each drop.

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

# Cancel a separate job
JOB2=$(curl -sS http://localhost:8001/api/jobs \
  -H "Authorization: Bearer dev" -H "X-User: alice" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"sess-002","container_image":"/cluster/images/agent.sif"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')

curl -sS -X DELETE "http://localhost:8001/api/jobs/$JOB2?reason=user_stop" \
  -H "Authorization: Bearer dev" -H "X-User: alice"
# {"job_id":"mock-...","status":"cancelled","reason":"user_stop"}
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
- `DELETE /api/jobs/{id}` happy path returns
  `{job_id,status:cancelled,reason}`
- 403 when caller does not own the job, 409 when already terminal,
  404 for unknown ids, 502 for slurmrestd errors, 422 for invalid reason
- Grace period actually delays `scancel` for freshly-submitted jobs

## Roadmap

| Task | Status |
|---|---|
| 1.1 FastAPI Setup | done |
| 1.2 Slurm Job Submission | done (mock-mode supported) |
| 1.3 Slurm Job Monitoring | done (mock-mode walks state machine) |
| 1.4 Slurm Job Cancellation | done (ownership + grace period) |
| 1.5 Vault Secret Retrieval | done (mock-mode, KV-v2, 60s TTL cache) |
| 1.6 SSE Streaming | done (broadcast, heartbeat, 100 msg/s rate limit, idle reaper) |
| 1.7 X-User Auth Middleware | done (format validation, session idle TTL, 10 req/s sliding-window, cross-user 403) |
| 2.1 Base Apptainer Image | done (recipe + build script + structural tests; .sif build deferred to operator) |
| 2.2 MCP Server Implementation | next |
| 2.3 OpenHands Agent Packaging | todo |
| 2.4 Inner Sandbox (nsjail/bubblewrap) | todo |
| 2.5 Network Filtering | todo |
| 2.6 vLLM Integration | todo |

## Phase 2: Container & Sandbox Infrastructure

The Apptainer recipes for the per-session agent runtimes live under
[`containers/`](containers/). Each agent framework (OpenHands, Goose,
…) is a derived image that bootstraps from
[`containers/base/base.sif`](containers/base/) (Task 2.1, ✅) via
`Bootstrap: localimage`. The base ships Python 3.11, Node 20, Google
Chrome stable, and the headless-browser runtime libs.

The build is deferred to whoever has cluster / build-host access (the
dev VM has no `apptainer` binary). The **recipe** is tested here via
`tests/test_apptainer_base.py` (static parsing — required sections,
package set, mount-point setup, `%runscript --help` exit 0, no proxy
hardcode). The **built image** is tested by
`containers/base/test_image.sh`, which the cluster operator runs on a
host with apptainer + the resulting `.sif`.
