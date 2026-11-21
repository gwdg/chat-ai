#!/usr/bin/env bash
# Starts the mocked e2e app instances outside Playwright, for poking at the app
# in a real browser while writing or debugging a scenario.
#
#   bash scripts/serve-apps.sh               # default app (:8090) + gated app (:8094)
#   bash scripts/serve-apps.sh --default     # only fixtures/front.e2e.json
#   bash scripts/serve-apps.sh --gated       # only fixtures/front.e2e-gated.json
#   PORT=8095 bash scripts/serve-apps.sh     # override the default app port
#
# The modules (`tools`, `agents`, `arcanas`, `sync`, …) are compiled in at Vite
# startup, which is why the gated build needs its own server on its own port.
# Ctrl+C stops both servers.
set -euo pipefail

cd "$(dirname "$0")/.."
E2E_DIR="$(pwd)"
FRONT_DIR="$(cd ../front && pwd)"

START_DEFAULT=1
START_GATED=1

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
    case "$arg" in
        --default|--default-only) START_GATED=0 ;;
        --gated|--gated-only) START_DEFAULT=0 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
done

DEFAULT_PORT="${PORT:-${E2E_APP_PORT:-8090}}"
GATED_PORT="${GATED_PORT:-${E2E_GATED_APP_PORT:-8094}}"
MOCK_PORT="${MOCK_PORT:-8091}"

require() {
    if [ ! -e "$1" ]; then
        echo "Missing $1" >&2
        echo "Run the setup once: npm run setup:e2e" >&2
        exit 1
    fi
}

require "$E2E_DIR/node_modules/.bin/playwright"
require "$E2E_DIR/fixtures/front.e2e.json"
require "$E2E_DIR/fixtures/front.e2e-gated.json"
require "$FRONT_DIR/package.json"
if [ ! -d "$FRONT_DIR/node_modules" ]; then
    echo "front/node_modules is missing. Run: cd ../front && npm i" >&2
    exit 1
fi

pids=()
cleanup() {
    trap - EXIT INT TERM
    for pid in "${pids[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

start_app() {
    local name="$1" config="$2" port="$3"
    echo "Starting $name on http://127.0.0.1:$port  ($(basename "$config"))"
    (
        cd "$FRONT_DIR"
        CONFIG_LOCATION="../e2e/fixtures/$(basename "$config")" \
            exec npm run dev -- --port "$port" --strictPort
    ) &
    pids+=("$!")
}

wait_for() {
    local url="$1" name="$2" attempts="${3:-180}"
    for _ in $(seq 1 "$attempts"); do
        if curl -fsS -o /dev/null "$url" 2>/dev/null; then
            echo "  $name is ready: $url"
            return 0
        fi
        sleep 1
    done
    echo "  $name did not answer at $url" >&2
    return 1
}

if [ "$START_DEFAULT" = 1 ]; then
    start_app "default app" "front.e2e.json" "$DEFAULT_PORT"
fi
if [ "$START_GATED" = 1 ]; then
    start_app "gated app" "front.e2e-gated.json" "$GATED_PORT"
fi

# Inside Playwright the three upstreams are intercepted per test. Here they have
# to answer for real, or the app shows no models and cannot send a message.
echo "Starting mock upstream on http://127.0.0.1:$MOCK_PORT"
(
    cd "$E2E_DIR"
    MOCK_PORT="$MOCK_PORT" exec node scripts/mock-upstream.mjs
) &
pids+=("$!")

status=0
wait_for "http://127.0.0.1:$MOCK_PORT/models" "mock upstream" || status=1
if [ "$START_DEFAULT" = 1 ]; then
    wait_for "http://127.0.0.1:$DEFAULT_PORT/" "default app" || status=1
fi
if [ "$START_GATED" = 1 ]; then
    wait_for "http://127.0.0.1:$GATED_PORT/" "gated app" || status=1
fi
if [ "$status" != 0 ]; then
    exit 1
fi

echo
if [ "$START_DEFAULT" = 1 ]; then
    echo "Open http://127.0.0.1:$DEFAULT_PORT/ (module-rich build)."
fi
if [ "$START_GATED" = 1 ]; then
    echo "Open http://127.0.0.1:$GATED_PORT/ (lean build)."
fi
echo "Press Ctrl+C to stop."
wait
