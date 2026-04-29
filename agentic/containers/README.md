# Apptainer images for the agentic layer

This directory holds the Apptainer (formerly Singularity) recipes and
build scripts for the per-session agent runtimes that the FastAPI
broker (`agentic/app/`) submits to Slurm.

The flow is:

```
broker (FastAPI)
    └─ POST /api/jobs
        └─ slurmrestd
            └─ Slurm spawns: apptainer run <image>.sif
                                    └─ MCP server + agent framework
```

## Layout

| Subdir | Task | Purpose | Status |
|---|---|---|---|
| [`base/`](base/)        | 2.1 | Foundation image (Python 3.11, Node 20, Chrome, tooling) | done |
| `mcp/`                  | 2.2 | MCP server (fs, web, code-exec tools) on top of base | TBD |
| `openhands/`            | 2.3 | OpenHands V1 agent + MCP client | TBD |
| `sandbox/`              | 2.4 | nsjail / bubblewrap inner sandbox configuration | TBD |
| `goose/`                | 4.1 | Goose agent framework | TBD |
| `smolagents/`           | 4.2 | Hugging Face smolagents | TBD |
| `opencode/`             | 4.3 | sst/opencode | TBD |

## Build order

`base/` must be built first; every other image bootstraps from it via
`Bootstrap: localimage` / `From: ../base/base.sif`. A typical full
rebuild:

```bash
cd agentic/containers/base       && ./build_image.sh --fakeroot --force
cd ../mcp                        && ./build_image.sh --fakeroot --force   # once it exists
cd ../openhands                  && ./build_image.sh --fakeroot --force   # once it exists
```

## Conventions

Every recipe in this directory follows the same shape:

- **Labels**: `org.chat-ai.image=<name>`, `org.chat-ai.task=<X.Y>`,
  `org.chat-ai.version=<semver>`. The build script stamps
  `org.chat-ai.git_sha` and `org.chat-ai.build_date` via
  `APPTAINERENV_*`.
- **Build script**: `build_image.sh` (POSIX `sh`) accepts at minimum
  `--fakeroot`, `--remote`, `--force`, `--output PATH`, `--help`. Exits
  non-zero if the resulting `.sif` exceeds the 5 GB budget.
- **Smoke test**: `test_image.sh` exits 0 only if every acceptance
  criterion of the parent task passes.
- **Mount points**: `/workspace` (1777, scratch), `/home/user` (per-user
  bind), `/tmp` (auto-bound by Apptainer).
- **Network**: no proxy hardcoded. The broker plumbs
  `APPTAINERENV_HTTPS_PROXY` per-session.
- **Run mode**: rootless, daemonless. Build mode is rootful (`--fakeroot`
  or `--remote` only).

## Static testing

The Python test suite under `agentic/tests/` includes
`test_apptainer_base.py`, which parses `base/Apptainer.def` as text and
asserts required sections / packages / mount-point setup are present.
This catches regressions (deleted packages, accidental proxy hardcodes,
stripped `--help` branch) without needing a build host.

```bash
cd agentic
pytest -q tests/test_apptainer_base.py
```

Future image directories should add a sibling `test_apptainer_<image>.py`
following the same pattern.

## Build artifacts are not committed

`*.sif`, `*.sif.meta.json`, `build/`, and `*.log` are git-ignored. The
recipes live in this repo; the binaries live in the GWDG registry (or
a shared filesystem path — registry URL TBD as of Task 2.1).
