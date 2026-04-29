# SDD Workflow Guide for Agentic Layer

## Spec-Driven Development (SDD) Stages Explained

The spec-kit SDD workflow follows these 5 stages for each feature. We have completed the first 3 stages and are ready to begin implementation.

### STAGE 1 - SPECIFY (COMPLETED)
**Purpose:** Define what we're building with comprehensive requirements
**Status:** ✅ COMPLETED at 2026-04-28

**What Was Done:**
- Created detailed specification document: `.specify/specs/001-agentic-layer/spec.md`
- Included:
  - Feature overview and architecture
  - User personas and 9 user stories with acceptance criteria
  - 8 functional requirements and 6 non-functional requirements
  - Constraints, assumptions, dependencies, out-of-scope items
  - Success metrics and glossary

**Artifacts:**
- 📄 `spec.md` - The single source of truth for the feature

**Next:** Already moved to Stage 2

---

### STAGE 2 - PLAN (COMPLETED)
**Purpose:** Break down the specification into high-level implementation strategy
**Status:** ✅ COMPLETED at 2026-04-28

**What Was Done:**
- Created implementation plan: `.specify/plans/001-agentic-layer/plan.md`
- Organized work into 5 implementation phases:
  1. **Foundation & Backend Services** (2-3 weeks)
  2. **Container & Sandbox Infrastructure** (3-4 weeks)
  3. **Frontend Integration** (2-3 weeks)
  4. **Multi-Agent Framework Support** (2 weeks)
  5. **Security & Testing** (3-4 weeks)
- Defined component architecture and data flows
- Created task dependency graph
- Identified risks and mitigation strategies

**Artifacts:**
- 📋 `plan.md` - High-level phase breakdown with timeline
- 🔗 Dependency graph showing task relationships
- ⚠️ Risk mitigation table

**Next:** Already moved to Stage 3

---

### STAGE 3 - TASKS (COMPLETED)
**Purpose:** Convert plan into granular, trackable development tasks
**Status:** ✅ COMPLETED at 2026-04-28

**What Was Done:**
- Created detailed task list: `.specify/tasks/001-agentic-layer/tasks.md`
- Broke down 5 phases into 31 actionable tasks:
  - Phase 1: 7 tasks (Foundation & Backend Services)
  - Phase 2: 6 tasks (Container & Sandbox Infrastructure)
  - Phase 3: 4 tasks (Frontend Integration)
  - Phase 4: 5 tasks (Multi-Agent Framework Support)
  - Phase 5: 5 tasks (Security & Testing)
- Each task includes:
  - Status (🔴 TODO, 🟡 IN PROGRESS, 🟢 DONE, 🔵 BLOCKED)
  - Priority (HIGH, MEDIUM, LOW)
  - Estimated effort (days)
  - Detailed requirements
  - Acceptance criteria
  - Dependencies
  - Definition of Done

**Artifacts:**
- ✅ `tasks.md` - 31 granular tasks ready for development
- 📊 Task statistics: 100-135 person-days total effort
- 🎯 Priority breakdown: 20 HIGH, 7 MEDIUM, 4 LOW tasks

**Next:** Now ready for Stage 4 - IMPLEMENT

---

### STAGE 4 - IMPLEMENT (CURRENT STAGE)
**Purpose:** Execute development work according to tasks
**Status:** 🔴 READY TO BEGIN

**What Happens During This Stage:**
1. **Code** - Write implementation code per task requirements
2. **Tests** - Write unit and integration tests
3. **Docs** - Update documentation as code is written
4. **Review** - Create pull requests, get peer reviews
5. **Merge** - Merge to feature branch after approval

**For Each Task:**
- Create feature branch from `001-agentic-layer`
- Write code according to task requirements
- Write tests to verify acceptance criteria
- Update documentation (README, API docs)
- Create PR with description linking to task
- Get peer review, address feedback
- Merge after approval
- Update task status from 🔴 TODO to 🟢 DONE

**Review Gates (Quality Assurance):**
- Before merging, ensure:
  ✅ All acceptance criteria met
  ✅ Unit tests written and passing
  ✅ Integration tests passing (if applicable)
  ✅ Code reviewed by at least one peer
  ✅ Documentation updated
  ✅ No breaking changes to existing functionality
  ✅ No security vulnerabilities introduced

**Artifacts:**
- 💻 Production code in `back/`, `front/`, and `broker/` directories
- 🧪 Test files in `back/tests/`, `front/tests/`, `broker/tests/`
- 📝 Updated README.md and API docs
- 🔢 GitHub issues created from tasks (optional for tracking)
- 🔀 Pull requests for each major group of related tasks

**Parallel Work:**
Some tasks can be done in parallel:
- Phase 1 tasks mostly dependent on each other (sequential)
- Phase 2 tasks can be parallelized after base image complete
- Phase 3 tasks can start once Phase 1 is done
- Phase 5 tasks wait until all previous phases complete

**Estimated Timeline:**
- **Phase 1:** 2-3 weeks (sequential, most critical)
- **Phase 2:** 3-4 weeks (some parallelization possible)
- **Phase 3:** 2-3 weeks (depends on Phase 1)
- **Phase 4:** 2 weeks (parallel with Phase 2-3)
- **Phase 5:** 3-4 weeks (depends on all previous)
- **Total:** 12-17 weeks for full implementation

**Next Steps to Begin Stage 4:**
1. ✅ Review this plan
2. ✅ Approve Phase 1 scope and timeline
3. ✅ Assign owners to first 5-10 high-priority tasks
4. ✅ Create GitHub issues for tracking (optional)
5. 🔄 Begin with Task 1.1: FastAPI Application Setup
6. 🔄 Parallel with 1.1: Start Task 2.1: Base Apptainer Image

---

### STAGE 5 - DELIVER (FUTURE STAGE)
**Purpose:** Deploy to production and validate success
**Status:** 🔴 NOT STARTED (will start after Stage 4 complete)

**What Happens During This Stage:**
1. Deploy to staging environment
2. Run acceptance tests against user stories
3. Load test with actual user traffic
4. Deploy to production
5. Monitor and validate success metrics
6. Gather user feedback
7. Iterate based on feedback

**Validation:**
- All 9 user stories validated
- Success metrics met (from spec):
  - 50% user adoption target
  - P99 latency < 5 seconds
  - Zero security incidents
  - 99.5% uptime
  - 99.9% successful sessions
- Beta user feedback positive
- Performance benchmarks met

**Artifacts:**
- 🚀 Production deployment
- 📈 Monitoring dashboards
- 📊 Success metrics report
- 🔄 Feedback-driven iteration plan

---

## Summary: Where We Are Now

### Completed Stages (1-3):
✅ STAGE 1: SPECIFY - Comprehensive specification document
✅ STAGE 2: PLAN - Implementation plan with 5 phases
✅ STAGE 3: TASKS - 31 detailed tasks ready for development

### Current Stage (4):
🔴 STAGE 4: IMPLEMENT - Ready to begin coding

### Remaining Stage (5):
🔴 STAGE 5: DELIVER - Not started (needs Stage 4 first)

---

## How to Code With SDD Workflow

### For Each Task:

1. **Pull from Feature Branch**
   ```bash
   cd /home/cloud/chat-ai
   git checkout 001-agentic-layer
   git pull origin 001-agentic-layer
   ```

2. **Create Task-Specific Branch**
   ```bash
   git checkout -b task-1.1-fastapi-setup
   ```

3. **Read the Task requirements carefully**
   - Review description, requirements, acceptance criteria
   - Understand dependencies and Definition of Done

4. **Implement the Task**
   - Write code per requirements
   - Write tests to verify acceptance criteria
   - Update documentation (README, API docs)

5. **Run Tests**
   ```bash
   # For FastAPI broker
   cd broker
   pytest tests/test_task_1_1.py -v

   # For Apptainer images
   apptainer build Image.sif Apptainer.def
   apptainer run Image.sif --help

   # For React frontend
   cd front
   npm test

   # For Node.js backend
   cd back
   npm test
   ```

6. **Update Task Status**
   - Mark task as 🟡 IN PROGRESS in `.specify/tasks/001-agentic-layer/tasks.md`
   - When complete, change to 🟢 DONE

7. **Commit and Push**
   ```bash
   git add .
   git commit -m "[task-1.1] FastAPI application setup done

   - Created FastAPI service with health check
   - Configured CORS for Node.js backend
   - Set up structured logging
   - Added requirements.txt

   Acceptance criteria met:
   - Health check returns 200 OK
   - CORS headers present
   - Logs JSON to stdout
   - README with startup instructions"
   git push origin task-1.1-fastapi-setup
   ```

8. **Create Pull Request**
   - Go to GitHub and create PR from `task-1.1-fastapi-setup` to `001-agentic-layer`
   - Link PR to Task 1.1 in description
   - Request peer review
   - Address review comments
   - Merge after approval

9. **Delete Task Branch**
   ```bash
   git checkout 001-agentic-layer
   git branch -D task-1.1-fastapi-setup
   ```

10. **Move to Next Task**
    - Repeat process for next task
    - Respect dependencies (can't start Task 1.2 until 1.1 complete)

---

## Branching Strategy

```
main (production)
  │
  └── 001-agentic-layer (feature branch, long-lived)
        │
        ├── task-1.1-fastapi-setup (PR merged)
        ├── task-1.2-slurm-job-submission (PR merged)
        ├── task-1.3-slurm-job-monitoring (in progress)
        ├── task-2.1-base-apptainer-image (parallel)
        └── ... (other task branches)
```

**Rules:**
- All work branches off `001-agentic-layer`
- Never branch directly off `main`
- Merge task branches to `001-agentic-layer` via PR
- When all tasks complete, merge `001-agentic-layer` to `main`

---

## Checklist for Starting Stage 4

Before beginning implementation:

- [ ] All team members have read spec.md (STAGE 1)
- [ ] All team members have read plan.md (STAGE 2)
- [ ] All team members have read tasks.md (STAGE 3)
- [ ] Feature branch `001-agentic-layer` exists
- [x] Development environment setup (terminal access verified)
- [ ] FastAPI service directory structure planned (`broker/`)
- [ ] Repository has proper linting and formatting configured
- [ ] CI/CD pipeline exists (or manual QA process defined)
- [ ] Team members assigned to tasks
- [ ] GitHub review schedule established (who reviews what)

First 5 tasks to begin:
1. [ ] Task 1.1: FastAPI Application Setup
2. [ ] Task 1.2: Slurm Integration - Job Submission
3. [ ] Task 1.5: Vault Integration - Secret Retrieval
4. [ ] Task 1.6: SSE Streaming Infrastructure
5. [ ] Task 2.1: Base Apptainer Image (can parallelize with 1.1)

Tasks 1.1, 1.2, 1.5, 1.6 are sequential (must do in order)
Task 2.1 has no dependencies and can be done in parallel

---

## Questions?

If you're unsure how to proceed:

1. **Read the spec** - All requirements are in `.specify/specs/001-agentic-layer/spec.md`
2. **Read the plan** - Understand the big picture in `.specify/plans/001-agentic-layer/plan.md`
3. **Read the task** - Look at specific requirements for the task you're working on
4. **Ask for clarification** - If something is unclear, create a GitHub issue or ask the team

---

**Version**: 1.0.0 | **Created**: 2026-04-28 | **Status**: Ready for Stage 4