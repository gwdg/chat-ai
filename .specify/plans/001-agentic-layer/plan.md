# Implementation Plan: Agentic Layer for Chat AI

## Overview

This plan breaks down the specification for adding an autonomous AI agent layer to the existing Chat AI application into manageable implementation phases. The implementation follows security-first principles and maintains seamless integration with existing infrastructure.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Existing Chat AI                            │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │ React Frontend│◄───────►│ Node Backend │                     │
│  └──────────────┘         └──────────────┘                     │
│         │                         │                             │
│         │ (SSE Streaming)        │ (Intercept)                   │
└─────────┼─────────────────────────┼─────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEW: Agentic Layer                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FastAPI Session Broker                                 │   │
│  │ - Request routing & validation                         │   │
│  │ - User authentication via X-User header                 │   │
│  │ - Slurm job management                                 │   │
│  │ - Vault secret injection                               │   │
│  │ - SSE streaming to frontend                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          │ (Slurm Job Submission)                 │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ HPC Cluster Environment                                 │   │
│  │  ┌──────────────┐      ┌──────────────┐               │   │
│  │  │  Apptainer   │◄────►│   MCP Server │               │   │
│  │  │  Container   │      │   (Tools)    │               │   │
│  │  └──────────────┘      └──────────────┘               │   │
│  │       │                                                   │   │
│  │       ├─ OpenHands / Goose / smolagents / opencode       │   │
│  │       ├─ browser-use (Playwright)                       │   │
│  │       ├─ nsjail / bubblewrap sandbox                    │   │
│  │       └─ Network filter (WWW-Cache proxy)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          │ (Inference)                           │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ vLLM Inference Server                                   │   │
│  │ - Qwen 3 30B or similar                                 │   │
│  │ - Hermes parser for tool calls                          │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                     External Services                           │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ Slurm HPC    │      │ HashiCorp    │      │ GWDG         │ │
│  │ Scheduler    │      │ Vault        │      │ WWW-Cache    │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### PHASE 1: Foundation & Backend Services
**Duration:** 2-3 weeks
**Dependency:** None (can start immediately)
**Goal:** Establish core FastAPI broker with Slurm integration

#### Components:
1. **FastAPI Application Setup** (Week 1)
   - Create FastAPI service structure
   - Implement health check endpoint
   - Set up logging and monitoring
   - Configure CORS for Node.js backend

2. **Slurm Integration** (Week 1-2)
   - Implement Slurm REST API client (slurmrestd)
   - Create job submission function for container workspaces
   - Implement job status polling
   - Add job cancellation functionality

3. **Vault Integration** (Week 2)
   - Implement HashiCorp Vault client
   - Create secret retrieval functions
   - Add secret validation and TTL management
   - Test with sample user secrets

4. **SSE Streaming Infrastructure** (Week 2-3)
   - Implement SSE endpoint for agent output
   - Create streaming pipeline from container to frontend
   - Add connection handling and cleanup
   - Test with SSE clients

5. **User Authentication & Validation** (Week 3)
   - Implement X-User header validation
   - Add OIDC tenant lookup
   - Create user workspace mapping
   - Add permission checks

**Deliverables:**
- FastAPI service running on port 8001 (or configured)
- Slurm job submission and monitoring working
- Vault secrets retrieval functional
- SSE streaming endpoint accepting connections
- User authentication middleware validating X-User header

**Acceptance Criteria:**
- Health check returns 200 OK
- Can submit Slurm job with container spec
- Can retrieve user secrets from Vault
- SSE connection accepted and accepts test messages
- Invalid X-User header rejected with 401

---

### PHASE 2: Container & Sandbox Infrastructure
**Duration:** 3-4 weeks
**Dependency:** Phase 1 complete (need FastAPI broker)
**Goal:** Build Apptainer containers with MCP tool integration

#### Components:
1. **Base Apptainer Images** (Week 1)
   - Create base Python 3.11+ Apptainer definition
   - Install system dependencies
   - Set up user namespace and mounts
   - Test container start/stop

2. **MCP Server Implementation** (Week 1-2)
   - Implement MCP server process inside container
   - Create tool implementations:
     - File system (safe, restricted access)
     - Web search (with proxy integration)
     - Code execution (sandboxed Python REPL)
   - Add tool validation and logging
   - Test tool invocations

3. **Agent Framework Packaging** (Week 2-3)
   - Package OpenHands V1 in Apptainer
   - Package Goose in Apptainer (optional)
   - Package smolagents (optional)
   - Package sst/opencode (optional)
   - Create environment variable configuration

4. **Inner Sandbox (nsjail/bubblewrap)** (Week 3)
   - Configure browser-use with Playwright + nsjail
   - Implement file system restrictions for browser process
   - Add network namespace isolation
   - Test browser security boundaries

5. **Network Filtering** (Week 3-4)
   - Configure HTTP_PROXY environment variable
   - Test proxy routing for web requests
   - Verify internal address blocking
   - Add DNS filtering if needed

6. **vLLM Integration** (Week 4)
   - Configure agent to use vLLM endpoint
   - Add Hermes parser configuration
   - Test tool call parsing
   - Verify streaming responses

**Deliverables:**
- Apptainer images stored in cluster registry
- MCP server running inside containers
- Agent frameworks (OpenHands minimum) packaged
- Browser sandbox isolation working
- Network filtering blocking internal addresses
- Agent successfully calling vLLM with tool calls

**Acceptance Criteria:**
- Container starts and accepts MCP client connections
- File system tool only accesses allowed directories
- Web search tool returns results via proxy
- Browser cannot access internal network addresses
- Agent completes simple task (e.g., "search for x and tell me")

---

### PHASE 3: Frontend Integration
**Duration:** 2-3 weeks
**Dependency:** Phase 1 complete (need FastAPI broker)
**Goal:** Modify chat interface to support agent selection and streaming

#### Components:
1. **Node.js Backend Modification** (Week 1)
   - Add agent model detection (new model naming convention)
   - Implement request interception logic
   - Forward agent requests to FastAPI broker
   - Back-propagate SSE stream to frontend

2. **React Frontend Updates** (Week 1-2)
   - Update model dropdown to include agent entries
   - Distinguish visually between "chat models" and "agents"
   - Add "Stop Agent" button (extension of existing controls)
   - Preserve existing chat sandbox/memory storage

3. **Real-Time Streaming UI** (Week 2)
   - Parse SSE messages for agent actions
   - Display agent actions in chat window
   - Format action timestamps and tool responses
   - Maintain scrolling and chat history

4. **Error Handling** (Week 2-3)
   - Display errors for failed Slurm jobs
   - Handle workspace provisioning errors
   - Show connection timeouts gracefully
   - Add user-friendly error messages

**Deliverables:**
- Node.js backend routing agent requests to FastAPI
- React frontend with agent model selection
- SSE streaming updates displayed in chat
- Robust error handling for edge cases

**Acceptance Criteria:**
- User selects "Agent - OpenHands" from dropdown
- Agent request forwarded to FastAPI broker
- User sees real-time agent actions in chat window
- User can stop agent with "Stop" button
- Errors displayed clearly without breaking UI
- Existing chat functionality unchanged

---

### PHASE 4: Multi-Agent Framework Support
**Duration:** 2 weeks
**Dependency:** Phase 2 complete (need container infrastructure)
**Goal:** Support multiple agent frameworks with consistent tooling

#### Components:
1. **Additional Agent Packaging** (Week 1)
   - Package Goose agent framework
   - Package smolagents
   - Package sst/opencode
   - Create default agent configuration files

2. **Agent Skills Framework** (Week 1-2)
   - Create SKILL.md template structure
   - Implement skill loader in MCP server
   - Write skills for:
     - GWDG Slurm script syntax
     - File system permissions
     - Network proxy usage
   - Add dynamic skill injection

3. **Framework-Specific Configuration** (Week 2)
   - Configure OpenHands prompt template
   - Configure Goose reasoning loop
   - Configure smolagents tool invocation
   - Configure opencode coding patterns
   - Add framework selection dropdown

**Deliverables:**
- All four agent frameworks packaged
- Agent Skills system functional
- Skills provide framework-specific guidance
- Users can select from multiple agents

**Acceptance Criteria:**
- All agents share same MCP tool set
- Each agent uses appropriate prompting
- Skills loaded correctly per framework
- User switches between agents seamlessly
- Task results consistent across frameworks

---

### PHASE 5: Security & Testing
**Duration:** 3-4 weeks
**Dependency:** Phase 3 complete (need full system integration)
**Goal:** Ensure security, performance, and reliability at scale

#### Components:
1. **Security Penetration Testing** (Week 1-2)
   - Test for file system traversal attempts
   - Test for network bypass attempts
   - Test for privilege escalation
   - Test for secret leakage
   - Fix all identified vulnerabilities

2. **End-to-End Testing** (Week 2)
   - Write E2E test for user stories:
     - US-001: Agent selection
     - US-002: Web search & summarization
     - US-003: Secure file analysis
     - US-004: Workspace isolation
     - US-005: Real-time streaming
   - Validate all acceptance criteria

3. **Performance Testing** (Week 2-3)
   - Load test with 100 concurrent users
   - Measure latency for agent request to first action
   - Measure SSE streaming latency
   - Profile FastAPI broker performance
   - Test Slurm queue handling under load
   - Optimize bottlenecks

4. **User Acceptance Testing** (Week 3)
   - Deploy to beta test environment
   - Recruit 10-20 beta users
   - Gather feedback on UX and performance
   - Iterate on issues found

5. **Production Readiness** (Week 4)
   - Set up monitoring dashboards (CPU, memory, Slurm jobs)
   - Configure alerting (job failures, high latency)
   - Create runbooks for troubleshooting
   - Conduct incident response drill
   - Final security review

**Deliverables:**
- Security vulnerability report and fixes
- E2E test suite passing
- Performance benchmarks meeting requirements
- Beta user feedback report
- Production deployment checklist
- Monitoring and alerting setup

**Acceptance Criteria:**
- Zero critical/high vulnerabilities
- All user stories validated with E2E tests
- P99 latency < 5 seconds for first action
- 99.5% uptime in beta testing
- 100 concurrent users sustained without failures
- Monitoring and alerting functional

---

## Task Dependencies Graph

```
Phase 1: Foundation
├─ FastAPI Setup (independent)
├─ Slurm Integration (depends on FastAPI Setup)
├─ Vault Integration (independent)
├─ SSE Streaming (depends on FastAPI Setup)
└─ Auth Validation (depends on SSE Streaming)

Phase 2: Container & Sandbox
├─ Base Images (independent)
├─ MCP Server (depends on Base Images)
├─ Agent Packaging (depends on Base Images)
├─ Inner Sandbox (depends on MCP Server)
├─ Network Filtering (depends on Agent Packaging)
└─ vLLM Integration (depends on MCP Server)

Phase 3: Frontend Integration
├─ Backend Modification (depends on Phase 1 SSE Streaming)
├─ Frontend Updates (depends on Backend Modification)
├─ Streaming UI (depends on Frontend Updates)
└─ Error Handling (depends on Streaming UI)

Phase 4: Multi-Agent Support
├─ Additional Packaging (depends on Phase 2 Base Images)
├─ Agent Skills (depends on Phase 2 MCP Server)
└─ Framework Config (depends on Additional Packaging and Agent Skills)

Phase 5: Security & Testing
├─ Security Tests (depends on Phase 3 complete)
├─ E2E Testing (depends on Phase 4 complete)
├─ Performance Tests (depends on Phase 4 complete)
├─ UAT (depends on Phase 4 complete)
└─ Production Readiness (depends on all above)
```

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Slurm queue delays affecting UX | High | Medium | Interactive partition priority lot, job preemption handling |
| Apptainer image size too large | Medium | High | Optimize with multi-stage builds, use base images from registry |
| MCP tool performance bottlenecks | Medium | Medium | Profile and optimize, add caching where safe |
| Email/Verifiable limits in facility graph invalid | Low | Low | Pre-deployment review of dependencies |
| Browser sandbox escapes | Low | Critical | Multi-layer sandbox (Apptainer + nsjail), regular security audits |
| vLLM Hermes parser incompatibility | Medium | High | Phase 2 early testing, fallback to manual parsing |
| FastAPI broker memory leak under load | Medium | Medium | Load testing in Phase 5, monitoring for cleanup |
| GWDG proxy blocking legitimate requests | Low | Medium | Early testing with proxy team, allowlist common domains |

## Success Metrics Tracking

During implementation, track these metrics:

- **GitHub Issues**: Created, In Progress, Done per Phase
- **Test Coverage**: Unit tests >80%, Integration tests covering critical paths
- **Performance Benchmarks**: Latency and throughput vs. targets
- **Security Scan Results**: Zero critical vulnerabilities
- **Beta User Adoption**: % of beta users trying agents, session duration
- **Error Rates**: Failed SSessions, Slurm job failures per week

## Next Steps

1. Review this plan with stakeholders
2. Approve Phase 1 scope and timeline
3. Create GitHub issues for Phase 1 tasks
4. Begin Phase 1 implementation with FastAPI setup

---

**Version**: 1.0.0 | **Created**: 2026-04-28 | **Status**: Draft