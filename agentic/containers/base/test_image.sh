#!/bin/sh
# test_image.sh — runtime smoke tests for the chat-ai base Apptainer image.
#
# Run on a host with apptainer + a built .sif. Exercises every Task 2.1
# acceptance criterion. Output is structured so the cluster operator can
# paste it into the PR comment as Definition-of-Done evidence.
#
# Usage: test_image.sh <path-to-base.sif>
#
# Optional env:
#   RUN_NETWORK_TESTS=1   exercise outbound HTTPS through chrome (requires
#                         host network or a working APPTAINERENV_HTTPS_PROXY)
#
# Exit code is 0 if all tests pass, otherwise the count of failed tests.

set -eu

if [ $# -ne 1 ]; then
    echo "usage: $(basename "$0") <path-to-base.sif>" >&2
    exit 1
fi

SIF="$1"

if [ ! -e "$SIF" ]; then
    echo "[fail] $SIF does not exist" >&2
    exit 1
fi

if command -v apptainer >/dev/null 2>&1; then
    APPTAINER=apptainer
elif command -v singularity >/dev/null 2>&1; then
    APPTAINER=singularity
else
    echo "[fail] apptainer/singularity not on PATH" >&2
    exit 1
fi

PASS=0
FAIL=0

check() {
    # check <label> <command...>
    LABEL="$1"; shift
    if "$@" >/dev/null 2>&1; then
        printf "[ok]   %s\n" "$LABEL"
        PASS=$((PASS + 1))
    else
        printf "[fail] %s\n" "$LABEL"
        FAIL=$((FAIL + 1))
    fi
}

check_match() {
    # check_match <label> <regex> <command...>
    LABEL="$1"; REGEX="$2"; shift 2
    OUT=$("$@" 2>/dev/null || true)
    if printf '%s' "$OUT" | grep -Eq "$REGEX"; then
        printf "[ok]   %s (got: %s)\n" "$LABEL" "$(printf '%s' "$OUT" | head -n1)"
        PASS=$((PASS + 1))
    else
        printf "[fail] %s (expected /%s/, got: %s)\n" "$LABEL" "$REGEX" "$(printf '%s' "$OUT" | head -n1)"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== chat-ai base image smoke test: $SIF ==="
echo

# ----- 1. apptainer run --help exits 0 -----
check "apptainer run --help exits 0" "$APPTAINER" run "$SIF" --help

# ----- 2. python3.11 -----
check_match "python3.11 present" "^Python 3\\.11\\." "$APPTAINER" exec "$SIF" python3.11 --version
check_match "python3 -> 3.11" "^Python 3\\.11\\." "$APPTAINER" exec "$SIF" python3 --version

# ----- 3. node 20+ -----
check_match "node 20+" "^v(20|2[1-9]|[3-9][0-9])\\." "$APPTAINER" exec "$SIF" node --version

# ----- 4. google-chrome present -----
check_match "google-chrome present" "Google Chrome" "$APPTAINER" exec "$SIF" google-chrome --version

# ----- 5. core tools -----
check "jq present"  "$APPTAINER" exec "$SIF" jq --version
check "git present" "$APPTAINER" exec "$SIF" git --version
check "curl present" "$APPTAINER" exec "$SIF" curl --version

# ----- 6. mount points -----
TMP=$(mktemp -d)
check "/workspace bound + writable" \
    "$APPTAINER" exec --bind "$TMP:/workspace" "$SIF" sh -c 'touch /workspace/probe && rm /workspace/probe'
rmdir "$TMP"

# ----- 7. rootless run -----
UID_INSIDE=$("$APPTAINER" exec "$SIF" id -u 2>/dev/null || echo 0)
if [ "$UID_INSIDE" != "0" ]; then
    printf "[ok]   runs as non-root inside (uid=%s)\n" "$UID_INSIDE"
    PASS=$((PASS + 1))
else
    printf "[fail] runs as uid=0 inside (should map to host user)\n"
    FAIL=$((FAIL + 1))
fi

# ----- 8. /etc/chat-ai-image-info -----
check "image info stamp present" "$APPTAINER" exec "$SIF" test -s /etc/chat-ai-image-info

# ----- 9. labels -----
echo "--- inspecting labels ---"
"$APPTAINER" inspect --labels "$SIF" 2>/dev/null | grep -E '^org\.chat-ai\.' || true

# ----- 10. size budget -----
SIZE_BYTES=$(stat -c%s "$SIF" 2>/dev/null || stat -f%z "$SIF")
LIMIT_5GB=5368709120
if [ "$SIZE_BYTES" -le "$LIMIT_5GB" ]; then
    printf "[ok]   size budget (%s bytes <= 5 GB)\n" "$SIZE_BYTES"
    PASS=$((PASS + 1))
else
    printf "[fail] size budget exceeded (%s bytes > 5 GB)\n" "$SIZE_BYTES"
    FAIL=$((FAIL + 1))
fi

# ----- 11. optional network exercise -----
if [ "${RUN_NETWORK_TESTS:-0}" = "1" ]; then
    check "chrome headless renders DOM" \
        "$APPTAINER" exec "$SIF" google-chrome --headless --disable-gpu --no-sandbox --dump-dom https://example.com
fi

echo
echo "=== summary: $PASS passed, $FAIL failed ==="

exit "$FAIL"
