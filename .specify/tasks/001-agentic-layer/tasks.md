# Tasks: Agentic Layer for Chat AI

## Overview

This document breaks down the implementation plan for the agentic layer into actionable, trackable tasks. Each task includes title, description, acceptance criteria, estimated effort, and dependencies.

## Task Status Legend
- 🔴 TODO: Not started
- 🟡 IN PROGRESS: Currently being worked on
- 🟢 DONE: Completed and tested
- 🔵 BLOCKED: Waiting on dependency

---

## PHASE 1: Foundation & Backend Services

### Task 1.1: FastAPI Application Setup
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 1-2 days
**Assignee:** TBD

**Description:**
Create the FastAPI microservice that will serve as the session broker for the agentic layer. This includes project setup, basic routing, health checks, and monitoring configuration.

**Requirements:**
- Use Python 3.11+ with FastAPI 0.104+
- Use Uvicorn as ASGI server
- Configure for production deployment (auto-reload disabled in prod)
- Set up structured logging
- Configure CORS to allow requests from Node.js backend

**Acceptance Criteria:**
- FastAPI application starts without errors on port 8001
- Health check endpoint `GET /health` returns `{"status": "healthy"}` with 200 OK
- CORS headers present in responses allowing `http://localhost:3000` (or configured frontend origin)
- Application logs to stdout with structured JSON format
- `requirements.txt` includes all dependencies
- README.md with startup instructions in root of FastAPI service

**Dependencies:** None

**Definition of Done:**
- Code reviewed and merged to 001-agentic-layer branch
- All acceptance criteria verified by another team member
- Commit message follows conventional commits format

---

### Task 1.2: Slurm Integration - Job Submission
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Implement Slurm REST API client for submitting containerized workspaces to the HPC cluster. This includes authentication, job specification, timeout handling, and error recovery.

**Requirements:**
- Use `python-slurm` or `requests` to call Slurm REST API (slurmrestd)
- Support Bearer token authentication (OIDC token from user session)
- Create job specification with:
  - Partition: `grete:interactive`
  - Containers: Apptainer image path
  - Time limit: 30 minutes default (configurable)
  - Environment variables: Vault secrets, proxy config
  - Memory: 16GB default (configurable)
  - CPUs: 4 default (configurable)
- Implement retry logic for transient failures
- Add timeout for job submission (30s)
- Log all Slurm API calls with request/response

**Acceptance Criteria:**
- `POST /api/jobs` endpoint accepts job specification and returns Slurm Job ID
- Successfully submits job to `grete:interactive` partition
- Returns 200 OK with `{"job_id": "<slurm-job-id>", "status": "submitted"}`
- Bearer token extracted from Authorization header forwarded to Slurm API
- Job specification includes all required fields (partition, container, env vars)
- On Slurm API error, returns appropriate HTTP status code:
  - 401 for authentication failure
  - 403 for authorization failure
  - 503 for Slurm unavailability
  - 400 for invalid request
- Logs job submission parameters to structured logs

**Dependencies:** Task 1.1 (FastAPI Setup)

**Definition of Done:**
- Unit tests for job submission function (mock Slurm API)
- Integration test with actual Slurm test partition (if available)
- Code reviewed and merged
- Documented in API README

---

### Task 1.3: Slurm Integration - Job Monitoring
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2 days
**Assignee:** TBD

**Description:**
Implement polling mechanism to monitor Slurm job status and propagate status changes to connected clients via SSE.

**Requirements:**
- `GET /api/jobs/{job_id}/status` endpoint returns current job status
- Poll job status every 2 seconds (configurable)
- Map Slurm job states to simplified states:
  - `PENDING` -> `queued`
  - `RUNNING` -> `running`
  - `COMPLETED` -> `succeeded`
  - `FAILED` -> `failed`
  - `CANCELLED` -> `cancelled`
  - `TIMEOUT` -> `timed_out`
- Cache job status for 1 second to reduce API calls
- Implement background polling task using `asyncio` and `aiohttp`
- Stop polling when job reaches terminal state (completed, failed, cancelled)

**Acceptance Criteria:**
- Status endpoint returns 200 OK with status info
- Response format: `{"job_id": "...", "status": "queued|running|succeeded|failed|cancelled|timed_out", "start_time": "", "end_time": "", "exit_code": null}`
- Job status polling runs in background without blocking main thread
- Polling stops automatically when job reaches terminal state
- Invalid job_id returns 404 Not Found
- Slurm API error returns 502 Bad Gateway with error detail

**Dependencies:** Task 1.2 (Slurm Job Submission)

**Definition of Done:**
- Unit tests for status mapping function
- Integration test with actual Slurm job (if available)
- Code reviewed and merged
- Add monitoring metric for polling failures

---

### Task 1.4: Slurm Integration - Job Cancellation
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 1-2 days
**Assignee:** TBD

**Description:**
Implement endpoint to cancel running Slurm jobs when user stops the agent or session expires.

**Requirements:**
- `DELETE /api/jobs/{job_id}` endpoint cancels job
- Call Slurm REST API `DELETE /slurm/v0.0.40/job/{job_id}`
- Verify job ownership before cancellation (match user X-User header to job user)
- Implement grace period: if job just started, allow 5 seconds before cancelling
- Log cancellation with reason (user_stop, timeout, session_end, admin_cancel)
- Return job status after cancellation attempt

**Acceptance Criteria:**
- Cancellation endpoint returns 200 OK on successful cancel
- Response: `{"job_id": "...", "status": "cancelled", "reason": "user_stop"}`
- Returns 403 Forbidden if user not owner of job
- Returns 404 Not Found if job_id invalid
- Returns 409 Conflict if job already completed
- Invalid X-User header returns 401 Unauthorized
- Slurm API error returns 502 Bad Gateway
- Job status after cancel shows `CANCELLED` state
- Grace period allows job to start if within 5 seconds

**Dependencies:** Task 1.3 (Slurm Job Monitoring)

**Definition of Done:**
- Unit tests for cancellation logic (mock Slurm API)
- Integration test cancelling actual test job
- Code reviewed and merged
- Add monitoring metric for cancellation failures

---

### Task 1.5: Vault Integration - Secret Retrieval
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Implement HashiCorp Vault client for retrieving user-specific secrets (API keys, PATs, tokens) to inject into Slurm jobs.

**Requirements:**
- Use `hvac` Python library for Vault API
- Configure Vault endpoint and authentication (AppRole or Kubernetes auth)
- Implement `get_user_secrets(user_id: str, secret_type: str)` function
- Secret paths pattern: `kv/users/{user_id}/secrets/` or `kv/tenants/{tenant_id}/secrets/` (configurable)
- Support secret types: `search_api_key`, `github_pat`, `oidc_token`
- Validate secret TTL and expiration
- Log secret retrieval (without exposing actual secret values)
- Implement cache with 60 second TTL to reduce Vault API calls
- Handle Vault errors gracefully

**Acceptance Criteria:**
- `GET /api/secrets/{secret_type}` endpoint returns secret for authenticated user
- Extracts user_id from X-User header
- Returns 200 OK with secret value: `{"secret_type": "...", "value": "...", "expires_at": "..."}`
- Returns 401 Unauthorized if X-User header invalid
- Returns 404 Not Found if secret not found in Vault
- Returns 502 Bad Gateway if Vault unavailable
- Secret value never logged (only presence/absence logged)
- Cache reduces Vault API calls by >90% for repeated requests
- Expired secrets return 410 Gone message

**Dependencies:** Task 1.1 (FastAPI Setup) (can be parallel with Slurm tasks)

**Definition of Done:**
- Unit tests for secret retrieval function (mock Vault)
- Integration test with actual Vault instance
- Code reviewed and merged
- Document Vault path patterns and secret types

---

### Task 1.6: SSE Streaming Infrastructure
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Implement Server-Sent Events (SSE) endpoint for streaming agent outputs from the container to the frontend chat interface.

**Requirements:**
- `GET /api/sse/{session_id}` endpoint accepts SSE connections
- Use FastAPI `StreamingResponse` with async generator
- SSE message format:
  - Agent actions: `event: action\ndata: {"type": "web_search", "message": "Searching for...", "timestamp": "..."}`
  - Tool results: `event: result\ndata: {"type": "web_search", "output": "...", "timestamp": "..."}`
  - Errors: `event: error\ndata: {"code": "SLURM_ERROR", "message": "...", "timestamp": "..."}`
- Maintain connection registry: map `session_id` to SSE response queues
- Implement heartbeat every 15 seconds to detect dead connections
- Handle client disconnect gracefully (cleanup queues)
- Support reconnection: client can reconnect with same session_id and resume
- Add rate limiting: max 100 messages per second per session

**Acceptance Criteria:**
- SSE endpoint accepts connections with 200 OK
- SSE messages include proper Content-Type: `text/event-stream`
- Heartbeat messages sent every 15 seconds while connected
- Client disconnect triggers cleanup of connection registry
- Rate limiting enforces 100 msg/sec limit, returns 429 Too Many Requests
- Reconnection with same session_id resumes streaming
- Multiple clients for same session_id receive same messages (broadcast)
- Messages delivered within 500ms of being enqueued
- Connection registry cleaned up on session end (timeout 5 min)

**Dependencies:** Task 1.1 (FastAPI Setup)

**Definition of Done:**
- Unit tests for SSE generator and queue management
- Load test with 100 concurrent SSE connections
- Code reviewed and merged
- Add monitoring for SSE connection count

---

### Task 1.7: User Authentication & Validation
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2 days
**Assignee:** TBD

**Description:**
Implement authentication middleware to validate X-User header from Kong authentication stack and map users to workspaces.

**Requirements:**
- Create FastAPI dependency injection for X-User validation
- Validate X-User header format: `<user_id>@<tenant_id>` (e.g., `john.doe@gwdg`)
- Validate user exists in OIDC user directory (optional: call Keycloak API)
- Create user workspace mapping: stored in memory or Redis for session duration
- Map workspace directory pattern: `/tmp/workspace-{user_id}-{session_id}/`
- Enforce permission checks:
  - User can only access their own workspace
  - User can only manage their own Slurm jobs
  - User can only retrieve their own secrets
- Implement session timeout: 30 minutes of inactivity
- Add rate limiting: 10 requests per second per user

**Acceptance Criteria:**
- FastAPI dependency validates X-User header exists
- Invalid X-User header format returns 401 Unauthorized
- Missing X-User header returns 401 Unauthorized
- User attempting to access another user's job returns 403 Forbidden
- User attempting to access another user's secrets returns 403 Forbidden
- Session mapping stored with 30 minute TTL
- Rate limiting enforces 10 req/sec limit per user
- Invalid user_id in X-User returns 401 (if validation enabled)
- All endpoints require authentication middleware

**Dependencies:** Task 1.6 (SSE Streaming) (for session management)

**Definition of Done:**
- Unit tests for auth dependency with mock users
- Integration test with actual Keycloak token (if available)
- Code reviewed and merged
- Add monitoring for authentication failures
- Document X-User header format

---

## PHASE 2: Container & Sandbox Infrastructure

### Task 2.1: Base Apptainer Image
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Create base Apptainer (formerly Singularity) container definition that serves as the foundation for agent workspaces.

**Requirements:**
- Base: Ubuntu 22.04 minimal or Debian Bookworm slim
- Python 3.11+ installed
- System dependencies:
  - `curl` for API calls
  - `git` for cloning repos
  - `jq` for JSON processing
  - Node.js 18+ (for browser-use/Playwright)
  - Chrome/Chromium headless browser (for web browsing)
- User namespace configuration: rootless, daemonless
- Mount points:
  - `/workspace` (scratch space, ephemeral)
  - `/home/user` (mapped from user's actual home via bind mount)
  - `/tmp` for temporary files
- Network configuration: default isolated, can enable proxy via env var
- Resource limits: set via Slurm, no container-level limits
- Build script to generate `.sif` image file

**Acceptance Criteria:**
- `Apptainer.def` file created with all dependencies
- Build script `build_image.sh` creates `.sif` image
- Container starts without errors: `apptainer run Image.sif --help`
- Python 3.11 available inside container
- Node.js 18+ available inside container
- Chrome/Chromium headless browser launches without X11
- Container runs under non-root user (no `--fakeroot` needed)
- Build process completes in <10 minutes
- Image size < 5GB (aim for 3-4GB range)

**Dependencies:** None (can start immediately, parallel with Phase 1)

**Definition of Done:**
- Container image uploaded to GWDG cluster registry
- Add to README: how to pull and run image
- Document customizations and mount points

---

### Task 2.2: MCP Server Implementation
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 5-7 days
**Assignee:** TBD

**Description:**
Implement Model Context Protocol (MCP) server inside the Apptainer container that provides tools to the agent frameworks (file system, web search, code execution).

**Requirements:**
- Use official MCP Python SDK or implement JSON-RPC 2.0 server
- Server runs as background process inside container
- Implements MCP tool interface:
  - List Tools: returns available tools with descriptions
  - Call Tool: executes tool with parameters, returns result
- Tool implementations:
  - `fs_read`: Read files from allowed paths (user's home, workspace)
  - `fs_write`: Write files to workspace only (not user's home)
  - `fs_list`: List files in allowed paths
  - `web_search`: Search web using search API (via proxy)
  - `web_browse`: Navigate to URL using headless browser (via proxy)
  - `code_exec`: Execute Python code in sandboxed REPL
  - `code_check`: Run linter/formatter on code
- Tool security:
  - Absolute path validation: only allow `/home/{user}/` and `/workspace/`
  - No symlink traversal or directory climbing
  - File size limits: max 10MB read, max 1MB write
  - Web filtering: force proxy, block internal addresses
  - Code exec: timeout 30 seconds, no network access
- Logging: log all tool calls (params, results) without sensitive data
- Error handling: standardized error format for all tools

**Acceptance Criteria:**
- MCP server starts inside container
- `list_tools` returns 7 tools with valid schemas
- `call_tool("fs_read", {"path": "/home/user/test.txt"})` reads file if allowed
- `call_tool("fs_read", {"path": "/etc/passwd"})` returns permission error
- `call_tool("fs_write", {"path": "/etc/passwd", "content": "..."})` blocked
- `call_tool("web_search", {"query": "test"})` uses proxy, returns results
- `call_tool("web_browse", {"url": "http://internal.gwdg.de"})` blocked
- `call_tool("code_exec", {"code": "print('test')"})` executes, returns output
- `call_tool("code_exec", {"code": "import os; os.system('rm -rf /')"})` timeout error
- All errors follow format: `{"error": {"code": "...", "message": "..."}}`
- Tool calls logged to stdout with structured JSON
- Server handles 100 concurrent requests without errors

**Dependencies:** Task 2.1 (Base Apptainer Image)

**Definition of Done:**
- Unit tests for each tool function
- Integration tests for tool security validation
- MCP spec compliance verified (client tests)
- Code reviewed and merged
- Document tool schemas and limitations

---

### Task 2.3: OpenHands Agent Packaging
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 3-4 days
**Assignee:** TBD

**Description:**
Package OpenHands V1 agent framework inside the Apptainer container with MCP client integration.

**Requirements:**
- Install OpenHands V1 from official repository (pip install)
- Configure OpenHands to use MCP server at `http://localhost:8080`
- Set environment variables:
  - `MCP_SERVER_URL=http://localhost:8080`
  - `LLM_API_URL=http://<vllm-endpoint>/v1/completions`
  - `LLM_MODEL=qwen3-30b` (or configured)
  - `LLM_PARSER=hermes` (tool call parser)
  - `HTTP_PROXY=http://www-cache.gwdg.de:3128`
  - `HTTPS_PROXY=http://www-cache.gwdg.de:3128`
- Create entry script to run OpenHands with MCP client
- Configure OpenHands tool enablement: use MCP instead of built-in tools
- Set OpenHands prompt template for agent behavior
- Add OpenHands logging configuration

**Acceptance Criteria:**
- OpenHands v1.x installed inside container
- OpenHands connects to MCP server on startup
- OpenHands receives tool list from MCP server
- OpenHands successfully calls `fs_read` tool
- OpenHands successfully calls `web_search` tool
- OpenHands prompts user via MCP (if required by workflow)
- OpenHands streams responses via stdout (forwarded to SSE)
- OpenHands runs without Docker/Podman (uses Apptainer only)
- Single command starts both MCP server and OpenHands

**Dependencies:** Task 2.2 (MCP Server Implementation), Task 2.1 (Base Image)

**Definition of Done:**
- Integration test: run OpenHands with MCP, execute simple task
- Document OpenHands configuration and environment variables
- Code reviewed and merged
- Add health check for OpenHands process

---

### Task 2.4: Inner Sandbox (nsjail/bubblewrap)
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 3-4 days
**Assignee:** TBD

**Description:**
Configure additional sandboxing using nsjail or bubblewrap to isolate the headless browser process preventing it from accessing container temp files or scanning the local HPC network.

**Requirements:**
- Install nsjail or bubblewrap inside Apptainer container
- Configure sandbox rules for browser process:
  - Separate mount namespace
  - Blocked filesystem access (no /tmp, no /proc except allowed paths)
  - No network access except via proxy
  - Resource limits (CPU, memory, number of processes)
  - No device access
- Integrate with browser-use / Playwright:
  - Launch browser via sandbox wrapper script
  - Configure browser profile directory in isolated mount
  - Set browser cache size limits
- Test security boundaries:
  - Browser cannot read container temp files
  - Browser cannot scan internal network
  - Browser cannot execute code outside sandbox
- Add sandbox logging for security audit

**Acceptance Criteria:**
- nsjail or bubblewrap installed and functional
- Browser launched via sandbox wrapper without errors
- Browser process isolated in separate namespace
- Browser cannot read `/tmp/` outside sandbox (verified by test)
- Browser cannot access internal IP addresses (verified by test)
- Browser cannot execute arbitrary code (verified by test)
- Sandbox logs show blocked attempts
- Container login shell still functional (not affected by sandbox)
- Memory overhead of sandbox < 100MB

**Dependencies:** Task 2.1 (Base Apptainer Image) (can be parallel with 2.2/2.3)

**Definition of Done:**
- Security test suite passes (try to break out of sandbox)
- Document sandbox configuration
- Add monitoring for sandbox violations
- Code reviewed and merged

---

### Task 2.5: Network Filtering
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Configure network filtering to force all outbound web traffic through the GWDG WWW-Cache proxy and block access to internal network addresses.

**Requirements:**
- Set environment variables in container:
  - `HTTP_PROXY=http://www-cache.gwdg.de:3128`
  - `HTTPS_PROXY=http://www-cache.gwdg.de:3128`
  - `NO_PROXY=localhost,127.0.0.1,vllm-service.cluster` (vLLM endpoint)
- Configure browser-use / Playwright to respect proxy settings
- Configure Python `requests` library to use proxy settings
- Add IP address filtering in MCP server (for web_browse tool):
  - Block private IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  - Block cluster internal addresses: (list from GWDG)
  - Reject URLs with private addresses in path
- DNS filtering: configure to reject internal domains (optional)
- Test proxy functionality with GWDG proxy team
- Add logging for blocked requests (URLs, reasons)

**Acceptance Criteria:**
- Container `curl` command uses proxy by default
- MCP `web_search` tool requests go through proxy
- MCP `web_browse` tool requests go through proxy
- Access to `http://www-cache.gwdg.de:3128` succeeds
- Access to `http://internal.gwdg.de` fails with error
- Access to `http://10.0.0.1` fails with error
- Access to `http://172.16.0.1` fails with error
- Access to `http://192.168.0.1` fails with error
- vLLM endpoint bypasses proxy (via NO_PROXY)
- Blocked requests logged with URL and reason
- GWDG proxy team confirms logs show agent requests

**Dependencies:** Task 2.2 (MCP Server - for web_browse tool)

**Definition of Done:**
- Network test suite verifies blocking rules
- Document proxy configuration and blocked ranges
- Create IP address parsing utility with tests
- Code reviewed and merged
- GWDG network team compliance verified

---

### Task 2.6: vLLM Integration
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 1-2 days
**Assignee:** TBD

**Description:**
Configure agent frameworks to use the existing vLLM inference server with Hermes parser for tool call processing.

**Requirements:**
- Configure LLM API endpoint: `http://<vllm-service>/v1/completions` (to be obtained)
- Select model: `qwen3-30b` or suitable open-source model
- Set parser: `--tool-call-parser hermes` (already configured on vLLM)
- Configure OpenHans/Goose/etc. to use OpenAI-compatible API format
- Test tool call parsing: agent output with tool calls recognized by Hermes parser
- Test streaming: vLLM streams tokens, agent receives incremental updates
- Error handling: handle vLLM unavailability, model errors
- Log LLM API calls (without user prompts)

**Acceptance Criteria:**
- Agent framework can call vLLM API endpoint
- Agent receives completions from vLLM
- Tool call format recognized by Hermes parser
- Example: agent output `web_search(query="quantum computing")` triggers MCP tool call
- Streaming works: agent receives tokens as they're generated
- vLLM error (400, 500, timeout) handled gracefully
- LLM API calls logged with latency metrics
- Response time < 1 second per request average

**Dependencies:** Task 2.3 (OpenHands Packaging) or Task 2.7 (Goose Packaging)

**Definition of Done:**
- Integration test with actual vLLM endpoint
- Document vLLM endpoint URL and model name
- Add monitoring for LLM API latency and errors
- Code reviewed and merged

---

## PHASE 3: Frontend Integration

### Task 3.1: Node.js Backend Modification
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Modify the existing Node.js Express backend to detect agent model selection and route requests to the FastAPI broker instead of the standard LLM API.

**Requirements:**
- Define agent model naming convention: `Agent - <framework>` (e.g., `Agent - OpenHands`, `Agent - Goose`)
- Add middleware to detect agent model selection in request body
- Create new routes:
  - `POST /api/chat/agent` -> forwards to FastAPI broker
  - `GET /api/chat/agent/sse` -> proxies SSE stream from FastAPI
- Existing route unchanged: `POST /api/chat` -> forwards to standard LLM API
- Extract user identity: extract X-User header from request, forward to FastAPI
- Create request body format for FastAPI:
  ```javascript
  {
    "model": "Agent - OpenHands",
    "messages": [...],  // chat history
    "user_id": "john.doe@gwdg",
    "session_id": "session-xyz",
    "stream": true
  }
  ```
- Proxy SSE stream: pipe FastAPI SSE responses to frontend
- Handle errors: translate FastAPI errors to appropriate HTTP statuses

**Acceptance Criteria:**
- Agent model selection detected correctly
- `POST /api/chat/agent` forwards request to FastAPI broker
- `POST /api/chat` unchanged, still forwards to LLM API
- X-User header forwarded to FastAPI broker
- SSE stream from FastAPI proxied to frontend without modification
- FastAPI 400/401/403 errors translated to same status in Node response
- FastAPI 502/503 errors translated to 500 Internal Server Error
- Request body format matches FastAPI expectations
- Streaming from FastAPI to frontend works end-to-end

**Dependencies:** Task 1.6 (SSE Streaming in FastAPI)

**Definition of Done:**
- Unit tests for agent detection middleware
- Integration test with actual FastAPI broker
- Code reviewed and merged
- Document new routes and request format
- Maintain backward compatibility with existing chat API

---

### Task 3.2: React Frontend - Agent Model Selection
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Update the React model dropdown to include agent options and distinguish them visually from standard chat models.

**Requirements:**
- Add agent options to model dropdown:
  - "Agent - OpenHands (Web + Code + Files)"
  - "Agent - Goose (Fast reasoning)"
  - "Agent - smolagents (Lightweight)"
  - "Agent - opencode (Code focus)"
- Visual distinction:
  - Add prefix icon (e.g., 🤖) for agents
  - Group agents separately from chat models (two sections in dropdown)
  - Add tooltip: "Agents can use tools (web, files, code)" for agent entries
- Preserve existing chat model entries (GPT-4, Claude, etc.) unchanged
- Update localStorage to save selected model (existing behavior)
- Clear previous chat context when switching from chat model to agent (optional: ask user)

**Acceptance Criteria:**
- Model dropdown shows both chat models and agents
- Agent entries prefixed with 🤖 icon
- Chat models and agents in separate sections/groups
- Tooltip appears on hover for agent entries: "Agents can use tools"
- Selecting an agent updates localStorage
- Switching between models updates UI correctly
- No visual layout changes to rest of chat interface
- Mobile-friendly dropdown (responsive)

**Dependencies:** None (can parallel with backend tasks)

**Definition of Done:**
- Visual design review (accessibility, contrast)
- Manual testing in all supported browsers
- Code reviewed and merged
- Update documentation with screenshots

---

### Task 3.3: React Frontend - Real-Time Streaming UI
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 3-4 days
**Assignee:** TBD

**Description:**
Implement UI components to parse and display SSE messages from the FastAPI broker, showing agent actions in real-time within the chat window.

**Requirements:**
- Parse SSE message format:
  ```javascript
  event: action
  data: {"type": "web_search", "message": "Searching for...", "timestamp": "..."}
  ```
- Display agent actions in chat window:
  - Use distinct styling (e.g., gray box, left-aligned)
  - Show timestamp in human-readable format
  - Show tool type as icon (e.g., 🔍 for web_search, 📄 for fs_read, 💻 for code_exec)
  - Show message content
- Display tool results:
  - Similar styling to actions (gray box)
  - Show output snippet (truncated if too long)
  - "Show more" button for long output
- Display errors:
  - Red styling with error icon (⚠️)
  - Show error code and message
- Maintain chat scrolling: auto-scroll when new message arrives
- Preserve existing chat message display for standard models
- Add "Stop Agent" button (extension of existing "Stop Generation")

**Acceptance Criteria:**
- SSE messages parsed correctly from `/api/chat/agent/sse`
- Agent actions displayed in gray box with icon and timestamp
- Tool results displayed similarly (gray box, truncated)
- Long output has "Show more" button that expands content
- Errors displayed in red box with error details
- Chat window auto-scrolls to latest message
- Chat history persists in localStorage (existing behavior)
- Standard chat messages (non-agent) display unchanged
- "Stop Agent" button appears when agent active, hides on completion
- User can scroll up to see earlier messages, auto-scroll resumes on new message
- Mobile-friendly: compact action/ error display

**Dependencies:** Task 3.1 (Node.js Backend SSE Proxy)

**Definition of Done:**
- E2E test: select agent, type prompt, see actions streamed
- Visual design review
- Manual testing with various agent actions
- Code reviewed and merged
- Update documentation with screenshots of agent UI

---

### Task 3.4: Error Handling & User Feedback
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Implement robust error handling throughout the frontend and backend to gracefully handle failures in the agentic layer.

**Requirements:**
Frontend errors:
- Slurm job failure: display error in chat with retry option
- Container start failure: display error, suggest user contact admin
- Network error: display "Connection lost, retrying" with auto-retry
- Timeout: display "Agent timed out, workspace closed"
- Agent framework crash: display "Agent encountered error, session ended"
- Permission error: display "Access denied, contact support"
Backend (Node.js):
- FastAPI broker unavailable: return 503 with error message
- Invalid X-User header: return 401 with message
- Malformed request: return 400 with validation errors
- Backend proxy:
  - FastAPI 4xx errors: forward as-is to frontend
  - FastAPI 5xx errors: convert to 500 Internal Server Error
  - Timeouts on FastAPI calls: return 504 Gateway Timeout

**Acceptance Criteria:**
- Slurm job failure error displayed in chat with message: "Workspace setup failed (Slurm job 1234 failed)"
- Container start failure: "Agent workspace failed to start. Error: ..."
- Network error: "Connection lost. Retrying..." displayed, auto-retries 3 times
- Timeout: "Agent session timed out after 30 minutes of inactivity" displayed
- Permission error: "Access denied: you cannot access another user's workspace" displayed
- FastAPI broker down: "Agent service temporarily unavailable. Please try again later."
- Invalid X-User: "Authentication required. Please log in again."
- All errors have appropriate HTTP status codes (400, 401, 403, 500, 503, 504)
- Error messages user-friendly (no stack traces)
- Retry button appears for transient errors (network, timeout)
- Error state doesn't break UI (chat remains functional)

**Dependencies:** Task 3.1 (Node.js Backend), Task 3.3 (Streaming UI)

**Definition of Done:**
- Error scenarios tested with deliberate failures
- User feedback gathered on error message clarity
- Code reviewed and merged
- Document error messages and retry logic
- Add monitoring for error rates

---

## PHASE 4: Multi-Agent Framework Support

### Task 4.1: Goose Agent Packaging
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Package the Goose agent framework inside the Apptainer container with MCP client integration (similar to OpenHands setup).

**Requirements:**
- Install Goose from official repository
- Configure Goose to use MCP server at `http://localhost:8080`
- Set environment variables (similar to OpenHands):
  - `MCP_SERVER_URL=http://localhost:8080`
  - `LLM_API_URL=http://<vllm-endpoint>/v1/completions`
  - `LLM_MODEL=qwen3-30b`
  - `LLM_PARSER=hermes`
  - `HTTP_PROXY=http://www-cache.gwdg.de:3128`
  - `HTTPS_PROXY=http://www-cache.gwdg.de:3128`
- Create entry script to run Goose with MCP client
- Configure Goose prompt template for agent behavior
- Configure Goose tool enablement: use MCP instead of built-in tools
- Test Goose with MCP tools (fs_read, web_search, etc.)

**Acceptance Criteria:**
- Goose installed inside container
- Goose connects to MCP server on startup
- Goose receives tool list from MCP server
- Goose successfully calls MCP tools
- Goose response streaming works
- Goose runs without Docker/Podman
- Simple task (e.g., "read /workspace/test.txt") succeeds
- Goose prompts user via MCP (if required)

**Dependencies:** Task 2.2 (MCP Server Implementation), Task 2.1 (Base Image)

**Definition of Done:**
- Integration test: run Goose with MCP, execute task
- Document Goose configuration
- Code reviewed and merged
- Add health check for Goose process

---

### Task 4.2: smolagents Packaging
**Status:** 🔴 TODO
**Priority:** LOW
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Package the Hugging Face smolagents framework inside the Apptainer container with MCP support.

**Requirements:**
- Install smolagents from official repository (pip install)
- Configure smolagents to use MCP server
- Set environment variables (similar to other agents)
- Create entry script
- Configure smolagents prompt template
- Configure tool enablement via MCP
- Test smolagents with MCP tools

**Acceptance Criteria:**
- smolagents installed and functional
- smolagents connects to MCP server
- smolagents calls MCP tools successfully
- End-to-end test with simple task passes

**Dependencies:** Task 2.2 (MCP Server Implementation), Task 2.1 (Base Image)

**Definition of Done:**
- Integration test passes
- Document configuration
- Code reviewed and merged

---

### Task 4.3: sst/opencode Packaging
**Status:** 🔴 TODO
**Priority:** LOW
**Est. Effort:** 2-3 days
**Assignee:** TBD

**Description:**
Package the sst/opencode framework inside the Apptainer container with MCP support.

**Requirements:**
- Install sst/opencode from official repository
- Configure opencode to use MCP server
- Set environment variables
- Create entry script
- Configure opencode prompt template
- Configure tool enablement via MCP
- Test opencode with MCP tools

**Acceptance Criteria:**
- sst/opencode installed and functional
- opencode connects to MCP server
- opencode calls MCP tools successfully
- End-to-end test with coding task passes

**Dependencies:** Task 2.2 (MCP Server Implementation), Task 2.1 (Base Image)

**Definition of Done:**
- Integration test passes
- Document configuration
- Code reviewed and merged

---

### Task 4.4: Agent Skills Framework
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 4-5 days
**Assignee:** TBD

**Description:**
Implement the Agent Skills system, which loads Markdown instruction files (SKILL.md) to provide framework-specific guidance to agents (e.g., proper Slurm script syntax for GWDG cluster).

**Requirements:**
- Define skills file format: Markdown with frontmatter
  ```yaml
  skill_name: "gwdg_slurm_scripts"
  framework: "openhands"
  description: "Syntax for GWDG cluster Slurm submission scripts"
  ```
- Create skill loader in MCP server:
  - Read skills from `/skills/` directory in container
  - Filter skills by framework (e.g., load only OpenHands skills if using OpenHands)
  - Inject skills into agent prompts via MCP tool `get_skills()`
- Create initial skills:
  - `gwdg_slurm_scripts.md`: Explanation of GWDG Slurm partition spec (grete:interactive), resource limits, required parameters
  - `file_permissions.md`: Explanation of allowed file paths, no symlink traversal
  - `web_proxy_usage.md`: How to configure proxy settings in code
  - `tool_syntax.md`: MCP tool invocation syntax (JSON-RPC)
- Add skill validation: check that skills have required fields
- Add skill caching: cache loaded skills to avoid re-reading

**Acceptance Criteria:**
- Skills loaded from `/skills/` directory on MCP server startup
- `get_skills()` tool returns list of skills for current framework
- Skills filtered by framework (OpenHands, Goose, etc.)
- OpenHands prompt includes skills content
- Example: User asks "Write a Slurm script" and agent uses `gwdg_slurm_scripts.md` skill
- Skills have valid frontmatter
- Invalid skills (missing fields) logged as warnings, skipped
- Skills cached, not re-read for each request
- Skills can be added/removed by updating Markdown files in /skills/

**Dependencies:** Task 2.2 (MCP Server Implementation), Task 2.3 (OpenHands Packaging)

**Definition of Done:**
- Unit tests for skill loader and validation
- Integration test: load skill, verify agent prompt includes it
- Create initial skills (gwdg_slurm_scripts, file_permissions, web_proxy_usage)
- Code reviewed and merged
- Document skill format and how to add custom skills

---

### Task 4.5: Multi-Agent Selection UI
**Status:** 🔴 TODO
**Priority:** MEDIUM
**Est. Effort:** 1-2 days
**Assignee:** TBD

**Description:**
Update the React frontend to allow users to select from multiple agent frameworks (OpenHands, Goose, smolagents, opencode) in the model dropdown.

**Requirements:**
- Update model dropdown agent section with all available agents:
  - "Agent - OpenHands (Web + Code + Files)" (default)
  - "Agent - Goose (Fast reasoning)"
  - "Agent - smolagents (Lightweight)"
  - "Agent - opencode (Code focus)"
- Add optional description tooltip for each agent
- Persist selected agent in localStorage
- When selecting agent, handle backend routing accordingly

**Acceptance Criteria:**
- All four agents appear in dropdown
- Each agent has description tooltip
- Selecting different agents updates UI correctly
- Backend receives selected agent in request
- Switching agents clears previous agent state (optional)

**Dependencies:** Task 3.2 (Agent Model Selection) (extend existing task), Task 4.1-4.3 (Agent Packaging)

**Definition of Done:**
- Visual design review
- Manual testing each agent
- Code reviewed and merged
- Update documentation with agent descriptions

---

## PHASE 5: Security & Testing

### Task 5.1: Security Penetration Testing
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 5-7 days
**Assignee:** TBD (or external security team)

**Description:**
Conduct comprehensive security penetration testing to identify vulnerabilities in file system, network, and container isolation.

**Requirements:**
- Test file system security:
  - Attempt directory traversal via symlinks
  - Attempt to read `/etc/passwd`, `/root/`, other user files
  - Attempt to write to `/home/other_user/`
  - Test file system permission enforcement
- Test network security:
  - Attempt to access internal IP addresses (10.x, 172.16-31.x, 192.168.x)
  - Attempt to bypass proxy settings
  - DNS poisoning attempts
  - Port scanning to find internal services
- Test container isolation:
  - Try to escape Apptainer container
  - Try to escape nsjail/bubblewrap sandbox
  - Test for side-channel attacks (CPU, memory)
- Test secret security:
  - Attempt to extract Vault secrets from environment
  - Test for secret leakage in logs
- Test session isolation:
  - Two users simultaneously, try to access each other's workspaces
  - Try to access each other's Slurm jobs
- Document all findings and remediation steps
- Fix all critical and high-severity vulnerabilities
- Re-test after fixes

**Acceptance Criteria:**
- Directory traversal attempts blocked with error
- File system permission violations blocked
- Internal network access attempts blocked
- Proxy bypass attempts fail
- Container escape attempts fail
- Sandbox escapes fail
- Secrets not leaked in logs or environment vars
- User A cannot access User B's workspace or jobs
- No critical vulnerabilities remaining
- No high-severity vulnerabilities remaining
- Security report generated with findings and fixes
- Re-testing confirms fixes are effective

**Dependencies:** All previous phases complete

**Definition of Done:**
- Security penetration test report completed
- All critical/high vulnerabilities fixed and tested
- Code reviewed by security team
- Document security best practices for users
- Add security tests to CI/CD pipeline

---

### Task 5.2: End-to-End Testing
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 4-5 days
**Assignee:** TBD

**Description:**
Write and execute end-to-end tests covering all user stories from the specification.

**Requirements:**
- Write E2E tests for user stories:
  - US-001: Agent selection - select agent from dropdown, verify routing
  - US-002: Web search & summarization - select agent, prompt search, verify output contains URLs and summary
  - US-003: Secure file analysis - create test file, prompt read file, verify content returned; prompt read /etc/passwd, verify blocked
  - US-004: Workspace isolation - two concurrent users, verify they cannot access each other's workspaces
  - US-005: Real-time streaming - select agent, prompt task, verify actions streamed with timestamps
  - US-006: Secret injection - verify agent receives API key, cannot access other's secrets
  - US-007: Agent swappability - switch between agents, verify same task succeeds with both
  - US-008: Network security - prompt to access internal URL, verify blocked
  - US-009: Session cleanup - close browser, verify workspace cleaned up
- Use testing framework: Playwright or Cypress for React frontend, pytest for backend
- Mock Slurm/Vault for reliable testing (optional)
- Run tests in CI/CD pipeline
- Generate test reports

**Acceptance Criteria:**
- All 9 user stories have E2E tests
- All tests pass consistently (no flaky tests)
- Tests cover happy paths and error paths
- Test execution time < 10 minutes
- Test reports generated with coverage metrics
- Tests integrated into CI/CD pipeline (run on every PR)
- Failing tests block PR merge

**Dependencies:** All previous phases complete

**Definition of Done:**
- E2E test suite completed
- All tests passing
- Test coverage documented
- CI/CD integration verified
- Code reviewed and merged
- Document test execution steps

---

### Task 5.3: Performance Testing
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 4-5 days
**Assignee:** TBD

**Description:**
Perform load testing to verify the system can handle 100+ concurrent users and meets performance requirements (latency, uptime).

**Requirements:**
- Load test tools: Locust, k6, or JMeter
- Test scenarios:
  - 100 concurrent users, each sending 10 agent requests
  - Measure latency: agent request to first streamed action
  - Measure latency: SSE message delivery
  - Measure CPU/memory usage of FastAPI broker
  - Measure Slurm queue backlog
- Performance targets:
  - P99 latency < 5 seconds for first action
  - SSE streaming latency < 500ms
  - FastAPI broker CPU < 50% at 100 concurrent users
  - Slurm queue backlog < 10 jobs at peak
- Profile bottlenecks:
  - Use cProfile for Python code
  - Use Chrome DevTools for React performance
  - Use Slurm metrics for HPC performance
- Optimize identified bottlenecks
- Add monitoring dashboards (Grafana/Prometheus)

**Acceptance Criteria:**
- Load test completed with 100 concurrent users
- P99 latency for first action < 5 seconds (90th percentile)
- SSE streaming latency < 500ms (90th percentile)
- FastAPI broker under 50% CPU at 100 concurrent users
- Slurm queue backlog < 10 jobs
- No memory leaks or resource exhaustion
- Monitoring dashboards created and functional
- Bottlenecks identified and optimized
- Load re-tested after optimizations

**Dependencies:** Task 5.2 (E2E Testing - system must be stable)

**Definition of Done:**
- Load test report generated
- Performance benchmarks documented
- Monitoring dashboards deployed
- Bottlenecks optimized
- Code reviewed and merged
- Document scaling recommendations

---

### Task 5.4: User Acceptance Testing (UAT)
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 2-3 weeks
**Assignee:** TBD (product manager + users)

**Description:**
Deploy to beta test environment and gather feedback from 10-20 real users to validate UX, performance, and reliability.

**Requirements:**
- Deploy system to beta environment (GWDG cluster)
- Recruit 10-20 beta users (researchers, students, admins)
- Onboarding session: explain agent capabilities, how to use, safety guidelines
- Usage period: 2 weeks
- Collect feedback via:
  - In-app surveys (after 5 sessions)
  - Email questionnaires
  - One-on-one interviews
- Metrics to track:
  - % of users who try agents (target: 80%)
  - Average sessions per user per week (target: 5)
  - % of successful sessions (target: 95%)
  - User satisfaction score (NPS survey, target: >7)
- Iterate on issues found

**Acceptance Criteria:**
- Beta environment deployed and stable
- 10-20 users recruited and onboarded
- 80% of users try agent feature at least once
- Average 5 sessions per user per week
- 95% of agent sessions complete successfully
- User satisfaction NPS > 7
- Top 5 issues identified and prioritized
- Action plan for prioritized issues created
- User feedback documented

**Dependencies:** Task 5.1, 5.2, 5.3 (security/E2E/perf tests passing)

**Definition of Done:**
- UAT report completed with findings
- User feedback analyzed
- Action plan for improvements created
- Prioritized bugs filed in GitHub
- Document best practices observed
- Gather testimonials for launch

---

### Task 5.5: Production Readiness
**Status:** 🔴 TODO
**Priority:** HIGH
**Est. Effort:** 1 week
**Assignee:** TBD (DevOps + engineering team)

**Description:**
Prepare system for production launch by setting up monitoring, runbooks, documentation, and final review.

**Requirements:**
- Set up monitoring and alerting:
  - Grafana dashboard: CPU, memory, latency, error rates, active sessions
  - Prometheus metrics for FastAPI, Slurm, vLLM
  - Alerting: job failures, high latency, security violations, downtime
- Create runbooks:
  - Runbook for Slurm job failures
  - Runbook for FastAPI broker downtime
  - Runbook for Vault unavailability
  - Runbook for security incident response
- Update documentation:
  - User guide: how to use agents, safety guidelines, limitations
  - Admin guide: system architecture, troubleshooting, scaling
  - API documentation: FastAPI endpoints, SSE format
- Final security review:
  - Review all security fixes
  - Review compliance with GWDG policies
  - Review audit logs
- Incident response drill: simulate outage, practice response
- Rollback plan: procedure to revert to previous version if launch fails

**Acceptance Criteria:**
- Grafana dashboard up and monitoring all key metrics
- Alert rules configured: PagerDuty/Slack notifications enabled
- All runbooks documented and reviewed
- User guide published in GWDG knowledge base
- Admin guide published for internal team
- API documentation updated and verified
- Final security review completed with sign-off
- Incident response drill completed, team familiarized
- Rollback plan documented and tested
- Production deployment checklist created

**Dependencies:** Task 5.4 (UAT complete)

**Definition of Done:**
- Monitoring and alerting functional
- All runbooks created and reviewed
- Documentation updated
- Security review sign-off received
- Incident response drill completed
- Rollback plan tested
- Production deployment checklist approved
- Launch date scheduled

---

## Task Statistics

- **Total Tasks:** 31
- **Tasks by Priority:**
  - HIGH: 20
  - MEDIUM: 7
  - LOW: 4
- **Tasks by Status:**
  - 🔴 TODO: 31
  - 🟡 IN PROGRESS: 0
  - 🟢 DONE: 0
  - 🔵 BLOCKED: 0
- **Estimated Total Effort:** 100-135 person-days

## Task Dependencies Summary

Critical Path:
1.1 → 1.2 → 1.3 → 1.4 (Foundation services)
2.1 → 2.2 → 2.3 (Container infrastructure)
1.6 + 1.7 → 3.1 → 3.3 (Frontend integration)
2.2 + 2.3 → 2.6 → 4.1/4.2/4.3 → 4.4 (Multi-agent)
All previous → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 (Testing & Production)

## Next Steps

1. Assign owners to tasks in Phase 1 and Phase 2
2. Create GitHub issues for first 5-10 high-priority tasks
3. Begin implementation with Task 1.1 (FastAPI Setup)
4. Parallel: start Task 2.1 (Base Apptainer Image) (no dependencies)

---

**Version**: 1.0.0 | **Created**: 2026-04-28 | **Last Updated**: 2026-04-28 | **Status**: Draft