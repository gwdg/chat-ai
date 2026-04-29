# Base Apptainer Image (Task 2.1)

Foundation image for chat-ai agent runtimes. Derived images
(`../mcp/`, `../openhands/`, …) bootstrap from this one via
`Bootstrap: localimage` / `From: ../base/base.sif` and add
framework-specific code on top.

## What's inside

| Component | Version | Source |
|---|---|---|
| Python | 3.11 | `ppa:deadsnakes/ppa` (symlinked at `/usr/local/bin/python3`) |
| Node.js | 20 LTS | `deb.nodesource.com/setup_20.x` |
| Browser | Google Chrome stable | direct `.deb` (`dl.google.com`) |
| Tools | jq, git, curl, wget, gnupg, tini, xz-utils | Ubuntu 22.04 apt |
| Runtime libs | libnss3, libasound2, libatk*, libcups2, … (full Chrome dlopen set) | Ubuntu 22.04 apt |

Build metadata is stamped in `/etc/chat-ai-image-info` and on the image's
`org.chat-ai.*` label set.

### Why Chrome instead of Chromium?

Ubuntu 22.04's apt `chromium-browser` package is a
[snap stub](https://askubuntu.com/q/1417000) that fails to start inside
containers. Google Chrome stable is a clean, self-contained `.deb`. The
spec wording is "Chrome/Chromium", and Chrome satisfies it. If the GWDG
cluster declines Google's redistributable terms, the alternative is
[Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/)
— swap step (4) of `%post` in `Apptainer.def`.

## Build

### Prerequisites

- Apptainer ≥ 1.2 (`module load apptainer` on the GWDG cluster).
- One of:
  - **`--fakeroot`**: a workstation with `/etc/subuid` and `/etc/subgid`
    mapping ≥ 65 536 IDs to your user, OR
  - **`--remote`**: any host with `apptainer remote login` configured.
- Outbound HTTPS to `archive.ubuntu.com`, `ppa.launchpadcontent.net`,
  `deb.nodesource.com`, `dl.google.com`, `pypi.org` for the duration of
  the build. If the build host is behind GWDG WWW-Cache, export
  `http_proxy` / `https_proxy` before invoking.

### Workstation

```bash
cd agentic/containers/base
./build_image.sh --fakeroot
# -> base.sif (~1.5–2 GB), base.sif.meta.json
```

### GWDG login node

```bash
module load apptainer
apptainer remote login   # one-time setup
cd agentic/containers/base
./build_image.sh --remote
```

### Other useful invocations

```bash
./build_image.sh --fakeroot --force                 # rebuild over existing
./build_image.sh --fakeroot --output /scratch/me/base.sif --log
./build_image.sh --fakeroot --sandbox               # writable dir, debug
./build_image.sh --help
```

The build is rootful at build time (apt-get inside the recipe needs root
inside the build root). The resulting `.sif` is run strictly rootless —
no `--fakeroot` at runtime, ever.

### Size budget

Hard ceiling: **5 GB** (acceptance criterion). The script exits 4 if
exceeded. Expected size today: 1.5–2 GB compressed. Trim opportunities
if the budget gets tight in derived images: drop `xz-utils`, drop
`fonts-noto-color-emoji`, switch to Chrome for Testing (smaller).

## Run

The base image is meant to be inherited from, but it is also runnable
on its own for sanity checks:

```bash
apptainer run base.sif --help                       # prints help, exit 0
apptainer run base.sif python3.11 --version
apptainer run base.sif node --version
```

### Standard bind set

The broker (Phase 1, `agentic/`) will invoke derived images with:

```bash
apptainer exec \
    --bind "$SLURM_TMPDIR":/workspace \
    --bind "$HOME":/home/user:ro \
    base.sif <command>
```

- `/workspace` is sticky-writable (`1777`), so the UID-mapped runtime user
  can write into the bind-mounted scratch space.
- `/home/user` defaults to the `:ro` mode. Agents that genuinely need to
  write into the user's home (e.g. saving a result) get `:rw` per session.
- `/tmp` is auto-bound by Apptainer and inherits the host's `1777`.

### Network

**Apptainer's default is host-network-shared**, not isolated. True
isolation requires runtime flags — this image does not enforce them.
The broker enforces network policy via Slurm + proxy:

```bash
APPTAINERENV_HTTP_PROXY=http://www-cache.gwdg.de:3128 \
APPTAINERENV_HTTPS_PROXY=http://www-cache.gwdg.de:3128 \
APPTAINERENV_NO_PROXY=localhost,127.0.0.1 \
apptainer exec --net --network=none base.sif curl -sSI https://example.com
```

Full network filtering (block private IP ranges, log violations) is
**Task 2.5**, not this task.

## Validate

```bash
./test_image.sh ./base.sif
```

Exercises every Task 2.1 acceptance criterion:

- `apptainer run --help` exits 0
- Python 3.11 / Node 20+ / Chrome stable callable
- jq / git / curl present
- `/workspace` writable when bind-mounted
- runs as non-root (UID-mapped)
- `/etc/chat-ai-image-info` populated
- size ≤ 5 GB
- with `RUN_NETWORK_TESTS=1`: Chrome headless renders a real DOM

The script's exit code is the count of failed checks (0 on full pass).

## Push to GWDG registry (Definition of Done)

> **TBD**: registry URL not yet confirmed by cluster ops. Likely
> `oras://<gwdg-harbor>/chat-ai/base:0.1.0` or a shared filesystem path
> like `/sw/containers/chat-ai/`. Update this section once known.

```bash
apptainer push base.sif oras://<gwdg-registry>/chat-ai/base:0.1.0
# or, if shared FS:
cp base.sif /sw/containers/chat-ai/base-0.1.0.sif
```

Pushing is **not** automated in `build_image.sh` — operator decision so
build artifacts don't accidentally land in a shared registry from a
local debug build.

## Roadmap of derived images

| Path | Task | Purpose |
|---|---|---|
| `../mcp/`        | 2.2 | MCP server inside the container (file system, web search, code exec tools) |
| `../openhands/`  | 2.3 | OpenHands V1 agent + MCP client |
| `../sandbox/`    | 2.4 | nsjail / bubblewrap inner sandbox for browser process |
| `../goose/`      | 4.1 | Goose agent framework |
| `../smolagents/` | 4.2 | Hugging Face smolagents |
| `../opencode/`   | 4.3 | sst/opencode |

Each derived image starts with:

```
Bootstrap: localimage
From: ../base/base.sif
```

## Troubleshooting

**"could not use fakeroot: setresuid: Operation not permitted"**

Your user is not mapped in `/etc/subuid` and `/etc/subgid`. Either ask
the host admin to add the mapping (`echo "$USER:100000:65536" | sudo tee -a /etc/subuid /etc/subgid`),
or use `--remote` with a configured remote builder.

**`apt-get` fails behind GWDG WWW-Cache**

Export `http_proxy` / `https_proxy` before `build_image.sh`. Apptainer
will inherit them into the build environment:

```bash
export http_proxy=http://www-cache.gwdg.de:3128
export https_proxy=http://www-cache.gwdg.de:3128
./build_image.sh --fakeroot
```

**Image is way bigger than expected**

Check `apptainer inspect --labels base.sif` for the build SHA, then
compare to a known-good build. If apt grabbed extra recommended
packages, ensure `--no-install-recommends` is still present in
`Apptainer.def %post`.

**Chrome fails to launch in headless mode at runtime**

Almost always a missing shared library. The runtime-libs apt list in
`%post` is the union of what `chrome --version --headless --no-sandbox`
needs on minimal Ubuntu 22.04. If you see `error while loading shared
libraries: libfoo.so.X`, add `libfoo` to that list and rebuild.
