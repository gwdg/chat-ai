# Chat AI Agentic Layer Constitution

## Core Principles

### I. Security-First Architecture

Every component implements defense-in-depth security:
- All workspaces are ephemeral and strictly isolated per user session
- No data leakage between workspaces, users, or environments
- Multi-layer sandboxing with Apptainer + nsjail/bubblewrap
- Network traffic strictly filtered through GWDG WWW-Cache proxy
- Secrets managed through HashiCorp Vault only; no environment or file exposure
- Rootless, daemonless container operation mandatory

### II. Academic Cloud Integration

The system integrates seamlessly with existing institutional infrastructure:
- Authentication flows through Kong + Apache mod_auth_openidc + Keycloak
- X-User header is the single source of truth for session identity
- All secrets (GitHub PATs, API keys, OIDC tokens) tenant-scoped and short-lived
- Compliance with GWDG HPC cluster policies required
- No external cloud services or commercial AI APIs

### III. Zero-Trust Data Privacy

User data never leaves its designated context:
- Central server-side chat log storage forbidden
- All permanent state resides in user's local browser or personal file storage
- Temporary workspaces destroyed immediately on session termination
- Read/write file access limited to user's personal storage area
- Audit trails for all privileged operations

### IV. Seamless UX Integration

The agentic layer enhances, never disrupts, the existing chat interface:
- Agent selection seamlessly integrated into existing model dropdown
- Standard chat requests handled normally; only "agent" requests routed differently
- Real-time streaming of agent actions compatible with current chat window format
- No separate UI or authentication flows created
- Progressive enhancement philosophy: chat works without agents, agents enhance chat

### V. Scalability & Resource Efficiency

Resources scale from testing to production thousands of concurrent users:
- FastAPI broker optimizes for async operations and high concurrency
- Slurm job submission must handle burst traffic without queue bottlenecks
- Workspace lifecycle management with automatic cleanup
- vLLM inference server usage optimized for GPU utilization
- State management avoids database bottlenecks; in-memory preferred

### VI. Open Standards & Extensibility

Future-proof through standard protocols and modularity:
- Model Context Protocol (MCP) for tool integration (USB for AI)
- Agent Skills (SKILL.md) for framework-specific guidance
- Agent framework swapable without tool reimplementation (OpenHands ↔ Goose ↔ smolagents ↔ sst/opencode)
- Standard OpenAI-compatible API endpoints
- Documentation-first development approach

## Technology Stack Requirements

### Frontend Integration
- React 19 + Vite (existing back/)
- No UI redesigns; minimal changes to agent model selection
- SSE (Server-Sent Events) for real-time agent action streaming
- LocalStorage persistence for chat and settings

### Backend Orchestration
- Node.js (existing back/): Modified to intercept agent requests
- FastAPI (new): Session broker handling Slurm, secret injection, SSE streaming
- HashiCorp Vault: Secret lifecycle management
- Slurm / slurmrestd: HPC workload manager integration

### Execution Environment
- Apptainer (formerly Singularity): Primary container runtime
- nsjail or bubblewrap: Secondary inner sandbox for browser processes
- GWDG WWW-Cache (http://www-cache.gwdg.de:3128): Egress proxy filter
- vLLM: LLM inference with Hermes parser (--tool-call-parser hermes)

### Agent Framework & Tools
- OpenHands V1 (default) or Goose/smolagents/sst/opencode (optional)
- browser-use / Playwright: Headless browser automation
- Model Context Protocol (MCP): Standard tool connector
- Agent Skills: Framework-specific guidance and syntax rules

## Development Workflow

### Specification Phase
All features follow Spec-Driven Development (SDD) workflow:
- Constitution → Specification → Plan → Tasks → Implementation
- Acceptance criteria documented with scenario-based examples
- Technical decisions recorded with rationale and trade-offs
- User stories include persona, context, and desired outcomes

### Testing Requirements
- Unit tests for all FastAPI endpoints and Node.js modifications
- Integration tests for Slurm job submission and lifecycle
- Security tests for sandbox isolation and network filtering
- End-to-end tests for complete user journeys (agent selection → execution → cleanup)
- Load testing simulating 1000+ concurrent users

### Code Review Gates
- Security review mandatory for all sandbox and secret management changes
- Performance review for any Slurm interaction or resource management changes
- Compliance review against GWDG HPC cluster policies
- Documentation review for all Agent Skills (SKILL.md files)

## Governance

- This constitution supersedes conflicting practices; all development must comply
- Amendments require documented rationale and migration plan
- Complex technical decisions must reference this constitution for justification
- Violations of security or privacy principles are blockers requiring immediate remediation

**Version**: 1.0.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-28