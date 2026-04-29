#!/bin/sh
# build_image.sh — build the chat-ai base Apptainer image (Task 2.1).
#
# POSIX sh (works on minimal build hosts; do NOT add bashisms).
#
# Build is rootful at build time (apt-get inside the recipe needs root inside
# the build root). Choose one of:
#   --fakeroot   workstation with /etc/subuid + subgid mapping for $USER
#   --remote     GWDG login node (or any host) using a remote builder
#                (apptainer must be configured with `apptainer remote login`)
#
# Run-time invocations of the resulting .sif are strictly rootless and never
# need --fakeroot (per spec).
#
# Exit codes:
#   0  success
#   1  usage error
#   2  apptainer / singularity not on PATH
#   3  build failed
#   4  built image exceeds 5 GB size budget

set -eu

set +e
SCRIPT_DIR=$(cd "$(dirname "$0")" 2>/dev/null && pwd)
set -e
DEF="${SCRIPT_DIR}/Apptainer.def"

OUTPUT="${SCRIPT_DIR}/base.sif"
FORCE=""
BUILDER_FLAG=""
SANDBOX=""
LOG_FILE=""

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

Options:
    --fakeroot          Build with --fakeroot (workstation; needs subuid map).
    --remote            Build with --remote (GWDG login node, no root needed).
    --force             Overwrite existing output.
    --sandbox           Build a writable sandbox directory instead of a .sif
                        (debug only; size budget skipped).
    --output PATH       Output path (default: ./base.sif).
    --log               Tee build output to <output>.log next to the image.
    -h, --help          Show this help.

Examples:
    $(basename "$0") --fakeroot
    $(basename "$0") --remote --force
    $(basename "$0") --output /scratch/me/base.sif --fakeroot --log

Image size budget: 5 GB (acceptance criterion). Builds exceeding it exit 4.
EOF
}

# ----- Parse args ----------------------------------------------------------
while [ $# -gt 0 ]; do
    case "$1" in
        --fakeroot)   BUILDER_FLAG="--fakeroot" ;;
        --remote)     BUILDER_FLAG="--remote" ;;
        --force)      FORCE="--force" ;;
        --sandbox)    SANDBOX="--sandbox" ;;
        --output)     shift; [ $# -gt 0 ] || { echo "missing arg for --output" >&2; exit 1; }; OUTPUT="$1" ;;
        --output=*)   OUTPUT="${1#--output=}" ;;
        --log)        LOG_FILE="auto" ;;
        -h|--help)    usage; exit 0 ;;
        *)            echo "unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
    shift
done

# ----- Pre-flight ----------------------------------------------------------
if command -v apptainer >/dev/null 2>&1; then
    APPTAINER=apptainer
elif command -v singularity >/dev/null 2>&1; then
    APPTAINER=singularity
    echo "[warn] using singularity fallback (apptainer not found)" >&2
else
    cat >&2 <<EOF
[fail] apptainer (or singularity) not on PATH.

On the GWDG cluster:    module load apptainer
On Ubuntu/Debian:       see https://apptainer.org/docs/admin/main/installation.html

EOF
    exit 2
fi

if [ ! -f "$DEF" ]; then
    echo "[fail] recipe not found: $DEF" >&2
    exit 1
fi

OUTPUT_DIR=$(dirname "$OUTPUT")
if [ ! -d "$OUTPUT_DIR" ]; then
    echo "[fail] output directory does not exist: $OUTPUT_DIR" >&2
    exit 1
fi
if [ ! -w "$OUTPUT_DIR" ]; then
    echo "[fail] output directory not writable: $OUTPUT_DIR" >&2
    exit 1
fi
if [ -e "$OUTPUT" ] && [ -z "$FORCE" ]; then
    echo "[fail] $OUTPUT already exists; pass --force to overwrite." >&2
    exit 1
fi

if [ -z "$BUILDER_FLAG" ] && [ "$(id -u)" -ne 0 ]; then
    cat >&2 <<EOF
[fail] no builder mode selected and you are not root.

Pick one of:
    --fakeroot     (workstation; subuid mapping for \$USER required)
    --remote       (GWDG login node; \`apptainer remote login\` first)

EOF
    exit 1
fi

# ----- Build metadata stamps ----------------------------------------------
GIT_SHA=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ -n "$LOG_FILE" ]; then
    LOG_FILE="${OUTPUT}.log"
    echo "[info] tee-ing build output to $LOG_FILE"
fi

echo "[info] apptainer       : $APPTAINER ($("$APPTAINER" --version 2>/dev/null || echo unknown))"
echo "[info] recipe          : $DEF"
echo "[info] output          : $OUTPUT"
echo "[info] builder mode    : ${BUILDER_FLAG:-root}"
echo "[info] sandbox         : ${SANDBOX:-no}"
echo "[info] git sha         : $GIT_SHA"
echo "[info] build date      : $BUILD_DATE"

# ----- Build ---------------------------------------------------------------
export APPTAINERENV_BUILD_SHA="$GIT_SHA"
export APPTAINERENV_BUILD_DATE="$BUILD_DATE"
export SINGULARITYENV_BUILD_SHA="$GIT_SHA"
export SINGULARITYENV_BUILD_DATE="$BUILD_DATE"

set +e
if [ -n "$LOG_FILE" ]; then
    # POSIX-portable pipe status capture: write rc of the producer to a tmp
    # file (since $PIPESTATUS is bash-only).
    RC_FILE=$(mktemp)
    ( "$APPTAINER" build $FORCE $BUILDER_FLAG $SANDBOX "$OUTPUT" "$DEF" 2>&1; echo $? > "$RC_FILE" ) | tee "$LOG_FILE"
    BUILD_RC=$(cat "$RC_FILE")
    rm -f "$RC_FILE"
else
    "$APPTAINER" build $FORCE $BUILDER_FLAG $SANDBOX "$OUTPUT" "$DEF"
    BUILD_RC=$?
fi
set -e

if [ "$BUILD_RC" -ne 0 ]; then
    echo "[fail] apptainer build exited $BUILD_RC" >&2
    exit 3
fi

# ----- Post-build ---------------------------------------------------------
if [ -n "$SANDBOX" ]; then
    echo "[ok]   sandbox built at $OUTPUT (size budget skipped)"
    exit 0
fi

echo "[info] inspecting labels..."
"$APPTAINER" inspect --labels "$OUTPUT" || true

SIZE_BYTES=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")
SIZE_HUMAN=$(du -h "$OUTPUT" | awk '{print $1}')
echo "[info] image size      : $SIZE_HUMAN ($SIZE_BYTES bytes)"

# 5 GB ceiling per acceptance criterion. 4.5 GB warning threshold.
LIMIT_5GB=5368709120
LIMIT_4_5GB=4831838208
if [ "$SIZE_BYTES" -gt "$LIMIT_5GB" ]; then
    echo "[fail] image exceeds 5 GB ceiling. Trim apt installs or split images." >&2
    exit 4
elif [ "$SIZE_BYTES" -gt "$LIMIT_4_5GB" ]; then
    echo "[warn] image > 4.5 GB; close to 5 GB ceiling. Consider trimming." >&2
fi

# Side-car JSON for the registry-push step (DoD).
META="${OUTPUT}.meta.json"
cat > "$META" <<EOF
{
  "image": "base",
  "task": "2.1",
  "version": "0.1.0",
  "git_sha": "${GIT_SHA}",
  "build_date": "${BUILD_DATE}",
  "size_bytes": ${SIZE_BYTES},
  "path": "${OUTPUT}"
}
EOF
echo "[info] wrote metadata  : $META"

echo "[ok]   build complete: $OUTPUT"
echo "[hint] validate with: ${SCRIPT_DIR}/test_image.sh \"$OUTPUT\""
