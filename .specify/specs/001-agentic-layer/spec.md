# Agentic Layer for Chat AI

## Feature Overview

We are adding a secure autonomous AI agent layer to the existing Chat AI web application used by GWDG (Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen). This layer enables users to select from various AI agents (OpenHands, Goose, smolagents, sst/opencode) that can actively perform tasks using tools like web browsing, file access, and code execution, while running in strictly isolated, temporary workspaces on the HPC cluster.

## User Personas

### Primary: Academic Researcher
- Context: Needs to perform complex multi-step tasks like "research latest physics papers online, download data, and summarize findings"
- Pain Point: Currently limited to text-only responses; cannot automate data gathering or analysis
- Success Criteria: Can delegate multi-step tasks to AI with trust in security and accuracy

### Primary: Graduate Student
- Context: Analyzes own data files stored on cluster
- Pain Point: Must manually write code for analysis; risks data exposure when using external AI tools
- Success Criteria: Agent reads files securely from personal storage only; provides insights without data leakage

### Primary: Cluster Administrator
- Context: Manages security and resource allocation for thousands of users
- Pain Point: Cannot allow AI agents unrestricted access to cluster infrastructure or other users' data
- Success Criteria: Complete isolation between user workspaces; external network access blocked; automatic cleanup on session end

### Secondary: Undergraduate Student
- Context: Learning AI or programming concepts
- Pain Point: Complex coding tasks broken across multiple chat sessions lack context persistence
- Success Criteria: Can see real-time agent actions; understands reasoning process through streamed updates

## User Stories

### US-001: Agent Selection
**As a researcher, I want to select an "agent" from the model dropdown so that I can ask the AI to perform complex, multi-step tasks.**

**Acceptance Criteria:**
- The existing model dropdown includes entries for "Agent - OpenHands", "Agent - Goose", etc.
- Selecting an agent entry does not change the UI layout; only message routing differs
- The dropdown clearly distinguishes between "chat models" (standard LLM) and "agents"
- Existing "chat model" selection and behavior remains unchanged

**Notes:** This is the entry point; users must explicitly opt-in to agent mode by selecting an agent from the dropdown.

### US-002: Web Search & Summarization
**As a researcher, I want the agent to search the web and summarizing information so that I can quickly gather relevant data without leaving the chat interface.**

**Acceptance Criteria:**
- User selects "Agent - OpenHands" from dropdown
- User prompts: "Search the web for the latest physics papers on quantum computing and summarize them"
- Chat streams agent actions: "Searching web...", "Reading paper abstract...", "Processing results..."
- Final response provides formatted summary with citations and links
- All web requests go through GWDG WWW-Cache proxy (http://www-cache.gwdg.de:3128)
- No internal network addresses are accessible to the agent

**Security Constraints:**
- Agent cannot access internal GWDG network or cluster management interfaces
- Network filters block requests to private IP ranges (10.x, 172.16-31.x, 192.168.x)
- All search API keys injected via Vault; not hardcoded

### US-003: Secure File Analysis
**As a student, I want the agent to read my files securely so that I can analyze my data without exposing it to others.**

**Acceptance Criteria:**
- User selects "Agent - Goose" from dropdown
- User prompts: "Read /home/user123/data/experiment_results.csv and calculate the average"
- Agent successfully reads file(s) from `/home/user123/` only
- Agent responds with calculated average
- Agent creates temporary files in `/tmp/workspace-user123-sessionXYZ/` only
- Agent blocks request: "Read /home/user456/private_data.txt" with error: "Access denied: file outside allowed workspace"

**Security Constraints:**
- File system access restricted to user's personal storage area
- Absolute path checks white-list: `/home/<username>/`
- Temporary workspace directory pattern enforced: `/tmp/workspace-<username>-<sessionID>/`
- No symlink traversal or directory climbing allowed

### US-004: Workspace Isolation
**As a cluster administrator, I want each user's agent to run in completely isolated sandbox so that one user's agent cannot access another user's data or disrupt the server.**

**Acceptance Criteria:**
- User A and User B both use agent feature simultaneously
- User A's agent creates workspace: `/tmp/workspace-userA-sessionA123/`
- User B's agent creates workspace: `/tmp/workspace-userB-sessionB456/`
- User A's agent cannot read User B's workspace files
- User A's agent cannot list `/tmp/` directory beyond their workspace prefix
- Slurm job created for User A cannot access User B's Slurm jobs
- Apptainer container for User A has separate namespace from User B's container

**Sandbox Layers:**
1. Apptainer container (user namespace, PID namespace, mount namespace isolation)
2. nsjail or bubblewrap (additional sandbox around browser process)
3. Network namespace with egress proxy as only outbound route
4. Slurm cgroup resource limits (CPU, memory, GPU)

### US-005: Real-Time Action Streaming
**As a user, I want to see the agent's real-time actions in the chat interface so that I can understand its reasoning process and trust its work.**

**Acceptance Criteria:**
- Chat window displays agent actions as they occur, not just final response
- Actions shown as formatted blocks: "✓ Searching web for 'quantum computing papers'"
- Actions include timestamps and tool responses when possible
- Final response clearly distinguished from intermediate actions
- User can pause/stop execution using "Stop" button (extension of existing chat controls)
- Stream format compatible with existing SSE implementation for standard chat

**Note:** Streaming must not break existing chat window behavior for non-agent messages.

### US-006: Automatic Secret Injection
**As a user, I want the agent to access necessary tools (web search, code execution) without me manually providing API keys, so that the experience is seamless.**

**Acceptance Criteria:**
- User selects "Agent - OpenHands" and prompts: "Search for recent ML papers"
- Agent requests search API key via MCP tool
- FastAPI broker retrieves search API key from Vault (tenant-scoped to user's OIDC tenant)
- Key injected into Slurm job environment: `SEARCH_API_KEY=<short-lived-key>`
- Agent uses key for search; key not visible to user or stored in chat logs
- After session ends, key is revoked or expires (short-lived token)

**Vault Integration:**
- Vault path pattern: `kv/users/<username>/secrets/` or `kv/tenants/<tenantId>/secrets/`
- Keys have TTL (time-to-live) matching session duration
- No secrets ever logged to file or database

### US-007: Agent Framework Swappability
**As a researcher, I want to try different agent frameworks (OpenHands, Goose, etc.) so that I can choose the one that works best for my task.**

**Acceptance Criteria:**
- User selects "Agent - OpenHands", runs task, sees result
- User switches dropdown to "Agent - Goose", runs same task
- All MCP tools (file system, web search, code execution) available to both agents
- Agent-specific differences only in reasoning loop, not tool access
- Agent Skills (SKILL.md files) provide framework-specific syntax guidance

**Note:** MCP protocol ensures tool compatibility across frameworks. Only framework differences are prompting strategies and internal behavior.

### US-008: Network Security Enforcement
**As a cluster administrator, I want the agent's web browser to be blocked from accessing internal network addresses so that the system remains secure.**

**Acceptance Criteria:**
- Agent attempts to navigate to `http://internal-cluster-admin.gwdg.de`
- Request blocked by GWDG WWW-Cache proxy with error: "Access denied - external proxy cannot route internal address"
- Agent sees error and continues task (or gracefully fails)
- No proxy bypass or direct network access available inside container
- DNS resolution for internal addresses fails or returns filtered results

**Egress Filtering:**
- All HTTP/HTTPS requests forced through `http://www-cache.gwdg.de:3128`
- Proxy configured to reject requests to private IP ranges and internal domains
- No direct outbound connections allowed from container network namespace

### US-009: Session Cleanup
**As a cluster administrator, I want workspaces automatically cleaned up after sessions end so that disk space is not exhausted and data cannot leak.**

**Acceptance Criteria:**
- User closes browser window or after 30 minutes of inactivity
- FastAPI broker receives session termination signal
- Slurm job cancelled: `scancel <job-id>`
- Apptainer container terminated
- Temporary workspace directory deleted: `rm -rf /tmp/workspace-<username>-<sessionID>/`
- Vault secrets (if short-lived) expire or are revoked
- No leftover processes or directories remain

**Cleanup Triggers:**
- User explicitly stops conversation
- Browser WebSocket/SSE connection closes
- Inactivity timeout (30 min)
- Cluster administrator termination signal

## Functional Requirements

### FR-001: Agent Request Interception
The system must intercept chat requests where the selected model is an "agent" and route them to the FastAPI session broker, while standard LLM requests proceed to the existing API endpoint unchanged.

**Implementation:** Node.js backend (back/) must detect agent model selection and redirect to FastAPI broker endpoint.

### FR-002: User Identity Resolution
The system must use the X-User header from the Kong authentication stack to map sessions to users and enforce permission boundaries.

**Implementation:** FastAPI broker validates X-User header against OIDC tenant mapping before creating workspace.

### FR-003: Workspace Provisioning
The system must launch a strictly isolated, temporary workspace for each user session via Slurm on the GWDG cluster.

**Implementation:** FastAPI submits Slurm job to interactive partition (grete:interactive) with Apptainer container specification.

### FR-004: Secret Injection
The system must dynamically inject user-specific secrets (GitHub PATs, API keys, OIDC tokens) into the Slurm job environment via HashiCorp Vault.

**Implementation:** FastAPI broker queries Vault for user secrets and passes as environment variables to Slurm job.

### FR-005: Tool Access via MCP
The AI agent must be equipped with tools connected via Model Context Protocol: web browsing, local file reading, sandboxed code execution.

**Implementation:** Agent code (OpenHands/Goose/etc.) runs inside Apptainer container with MCP server process.

### FR-006: Real-Time Streaming
The system must stream agent outputs (markdown/text and tool-use updates) back to the chat interface via Server-Sent Events (SSE), maintaining compatibility with existing chat window format.

**Implementation:** FastAPI broker uses SSE to push updates to Node.js backend, which forwards to React frontend via existing WebSocket/SSE implementation.

### FR-007: Network Filtering
The system must force all outbound web traffic from the agent's browser through the GWDG WWW-Cache proxy, blocking internal network access.

**Implementation:** Container environment variable `HTTP_PROXY=http://www-cache.gwdg.de:3128` set; browser-use library configured to use proxy.

### FR-008: Session Termination & Cleanup
The system must automatically revoke workspace access, delete temporary directories, cancel Slurm jobs, and expire secrets when a session ends.

**Implementation:** FastAPI broker monitors SSE connection and implements background cleanup tasks on disconnect or timeout.

## Non-Functional Requirements

### NFR-001: Security
- Multi-layer sandboxing with Apptainer + nsjail/bubblewrap
- Secrets never exposed in logs, environment files, or database
- Zero-trust: all file system and network access verified per request
- Rootless, daemonless container operation
- Short-lived secrets with automatic expiration

### NFR-002: Privacy
- No central server-side chat log storage
- All permanent state in user's local browser or personal file storage
- Temporary workspaces destroyed immediately on session termination
- Audit trail for privileged operations only (not chat content)

### NFR-003: Scalability
- Support 100+ concurrent users during testing phase
- Support 1000+ concurrent users in production
- Slurm job submission must handle burst traffic without queue bottlenecks
- FastAPI async operations optimized for high concurrency
- vLLM inference server optimized for GPU utilization

### NFR-004: Performance
- Agent request to first streamed action < 3 seconds (warm start)
- Streaming latency < 500ms between agent action and chat window display
- Workspace provisioning (Slurm job launch) < 10 seconds target
- Session cleanup completes < 5 seconds

### NFR-005: Integration
- Seamless integration with existing Kong + Apache mod_auth_openidc + Keycloak auth stack
- No separate UI or authentication flows; agent model selection integrated into existing dropdown
- Real-time streaming compatible with existing chat window SSE implementation
- Existing chat model selection and behavior unchanged for non-agent requests

### NFR-006: Compliance
- Complies with GWDG HPC cluster policies (no Docker, rootless containers only)
- No external cloud services or commercial AI APIs
- All code execution sandboxed and ephemeral
- Academic data sovereignty preserved (data stays on cluster)

## Constraints

### C-001: No New UI from Scratch
Must integrate seamlessly into the existing chat frontend and backend (back/ and front/). No complete UI redesigns.

### C-002: HPC Cluster Limitations
- Docker and Podman not allowed; must use Apptainer (rootless, daemonless)
- WebSocket connections limited; prefer SSE for streaming
- Slurm partitions have resource limits; job must fit within grete:interactive specs
- Shared GPU resources; vLLM must use batched inference

### C-003: Storage Constraints
- No centralized database for chat logs
- All chat history stored in user's browser localStorage
- Temporary workspaces limited in disk usage (quota enforced by Slurm)

### C-004: Network Constraints
- All outbound web traffic must go through GWDG WWW-Cache proxy
- No access to internal cluster management interfaces
- DNS resolution filtered for internal addresses

### C-005: Resource Constraints
- Single FastAPI microservice to handle all session broker logic
- vLLM inference server already running; cannot be modified for this project
- Apptainer images must be pre-built and stored in cluster registry

## Assumptions

### A-001: vLLM Availability
The vLLM inference server is already running on the cluster GPUs and configured with the Hermes parser (--tool-call-parser hermes). This project does not need to deploy vLLM.

### A-002: HashiCorp Vault Access
A HashiCorp Vault instance is available and configured with appropriate policies for storing user secrets (short-lived API keys, GitHub PATs).

### A-003: Slurm Availability
The GWDG cluster has Slurm running with an interactive partition (grete:interactive) suitable for launching containerized workloads.

### A-004: Existing Code Base
The existing Chat AI code base (front/ and back/) is well-structured and documented, making it feasible to add the agent interception logic.

### A-005: User Capacity
During testing phase, we have access to 10-20 beta users. Production launch targets 1000+ users.

## Dependencies

### D-001: IaC Updates
Apptainer recipe files must be created for the agent framework containers (OpenHands, Goose, smolagents, sst/opencode).

### D-002: MCP Server Implementation
MCP server must be implemented inside the Apptainer container to provide tools to the agent (file system, web search, code execution).

### D-003: Vault Policies
HashiCorp Vault policies must be configured to allow the FastAPI broker to read user secrets with appropriate scope.

### D-004: Proxy Configuration
GWDG WWW-Cache proxy must be configured to block access to internal network addresses and private IP ranges.

### D-005: vLLM Model Availability
Open-source models suitable for agent tasks must be available on vLLM (e.g., Qwen 3 30B).

## Out of Scope

### O-001: Agent Framework Core Logic
The internal reasoning loops of agent frameworks (OpenHands, Goose, etc.) are out of scope. We integrate them as black boxes running in containers.

### O-002: vLLM Model Training or Fine-tuning
We are using existing open-source models on vLLM. No model training, fine-tuning, or custom model development.

### O-003: Vault Secret Management UI
Users will manage their secrets through existing GWDG portals (GitHub PAT management, OIDC token issuance). No custom Vault UI needed.

### O-004: Custom Browser Implementations
We will use browser-use / Playwright libraries for headless browser automation. No custom browser implementations.

### O-005: Distributed Agent Coordination
This project focuses on single-user, single-session workspaces. Multi-agent collaboration or swarm intelligence is out of scope.

## Success Metrics

### SM-001: User Adoption
- 50% of beta users try the agent feature within first month
- Average of 5 agent requests per beta user per week

### SM-002: Performance
- P99 latency for agent request to first streamed action < 5 seconds
- Session cleanup completes within 10 seconds, 99% of the time

### SM-003: Security
- Zero security incidents (data leaks, privilege escalations, unauthorized network access) in first 6 months
- All sandbox penetration tests pass

### SM-004: Reliability
- 99.5% uptime for FastAPI session broker
- 99.9% of agent sessions complete successfully without errors

### SM-005: Scalability
- Successful load test with 100 concurrent users for 1 hour
- Production target: 500 concurrent users at launch (Phase 1), 1000+ (Phase 2)

## Glossary

- **Apptainer**: Container runtime for HPC clusters (formerly Singularity), runs rootless and daemonless.
- **Agent Framework**: Software implementing the AI reasoning loop (OpenHands, Goose, smolagents, sst/opencode).
- **FastAPI Broker**: New Python microservice that manages agent sessions, Slurm jobs, and secret injection.
- **GWDG**: Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen (institution operating the HPC cluster).
- **HashiCorp Vault**: Secret management tool for securely storing and injecting user-specific credentials.
- **MCP (Model Context Protocol)**: Open standard protocol for connecting AI agents to tools (like "USB for AI").
- **nsjail / bubblewrap**: User-space sandboxing tools for isolating processes (additional layer inside Apptainer).
- **Slurm**: Simple Linux Utility for Resource Management, the HPC workload manager.
- **vLLM**: High-throughput LLM inference server that serves models on GPUs.
- **Workspace**: Temporary, isolated environment where a single user's agent runs for one session (directory + container + Slurm job).

---

**Version**: 1.0.0 | **Created**: 2026-04-28 | **Status**: Draft