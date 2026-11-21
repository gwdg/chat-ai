#!/usr/bin/env bash
# Installs and verifies what the e2e suites need on this machine.
#
#   bash scripts/install-browsers.sh              # Playwright chromium, firefox, ffmpeg
#   bash scripts/install-browsers.sh --with-deps  # ... and the host libraries
#   bash scripts/install-browsers.sh --webkit     # also WebKit (needs extra libraries)
#   bash scripts/install-browsers.sh --check      # install nothing, only verify
#   bash scripts/install-browsers.sh --install-chrome
#                                                 # install Google Chrome (apt) for the
#                                                 # channel:"chrome" projects
#
# Everything is idempotent: installed browsers and packages are left alone.
set -euo pipefail

cd "$(dirname "$0")/.."

BROWSERS=(chromium firefox)
WITH_DEPS=0
CHECK_ONLY=0
INSTALL_CHROME=0
WITH_WEBKIT=0

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
    case "$arg" in
        --with-deps) WITH_DEPS=1 ;;
        --webkit) WITH_WEBKIT=1 ;;
        --check) CHECK_ONLY=1 ;;
        --install-chrome) INSTALL_CHROME=1 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
    esac
done

if [ "$WITH_WEBKIT" = 1 ]; then
    BROWSERS+=(webkit)
fi

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; DIM=''; RESET=''
fi
ok()   { echo "  ${GREEN}✔${RESET} $*"; }
warn() { echo "  ${YELLOW}!${RESET} $*"; }
bad()  { echo "  ${RED}✘${RESET} $*"; }
note() { echo "    ${DIM}$*${RESET}"; }

SUDO=""
if [ "$(id -u)" = 0 ]; then
    SUDO=""
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    SUDO="sudo -n"
fi

install_deps() {
    local deps=()
    for browser in "${BROWSERS[@]}"; do
        deps+=("$browser")
    done
    if [ "$(id -u)" = 0 ]; then
        npx playwright install-deps "${deps[@]}"
    elif [ -n "$SUDO" ]; then
        $SUDO npx playwright install-deps "${deps[@]}"
    elif [ -t 0 ] && command -v sudo >/dev/null 2>&1; then
        # Interactive terminal: let sudo ask for the password.
        sudo npx playwright install-deps "${deps[@]}"
    else
        bad "host libraries need root and sudo is not available without a password"
        note "run: sudo npx playwright install-deps ${deps[*]}"
        return 1
    fi
}

install_google_chrome() {
    if command -v google-chrome >/dev/null 2>&1; then
        ok "Google Chrome is already installed"
        return 0
    fi
    if ! command -v apt-get >/dev/null 2>&1 || ! command -v dpkg >/dev/null 2>&1; then
        bad "automatic Chrome installation supports apt-based distributions only"
        note "install Google Chrome manually: https://www.google.com/chrome/"
        return 1
    fi
    if [ "$(id -u)" != 0 ] && [ -z "$SUDO" ]; then
        bad "installing Google Chrome needs root and passwordless sudo is unavailable"
        note "run the script with sudo, or install Chrome manually"
        return 1
    fi
    local arch
    arch="$(dpkg --print-architecture)"
    echo "  Installing Google Chrome (apt, $arch)…"
    $SUDO install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | $SUDO gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg
    echo "deb [arch=$arch signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        | $SUDO tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
    $SUDO apt-get update
    $SUDO apt-get install -y google-chrome-stable
}

echo "e2e setup: ${BROWSERS[*]}"
command -v node >/dev/null 2>&1 || { bad "node is not on PATH"; exit 2; }
command -v npm  >/dev/null 2>&1 || { bad "npm is not on PATH"; exit 2; }

if [ "$CHECK_ONLY" = 0 ]; then
    if [ ! -x node_modules/.bin/playwright ]; then
        echo "  Installing e2e npm dependencies…"
        npm i
    fi

    echo "  Installing Playwright browsers: ${BROWSERS[*]}"
    npx playwright install "${BROWSERS[@]}"
    ok "Playwright browsers installed"

    # Video recording (the documentation fixture writes one per test) uses
    # Playwright's own ffmpeg build, which `install <browsers>` does not fetch.
    if npx playwright install ffmpeg >/dev/null 2>&1; then
        ok "Playwright ffmpeg installed (video recording)"
    else
        warn "Playwright ffmpeg could not be installed; videos will be skipped"
        note "run: npx playwright install ffmpeg"
    fi

    if [ "$INSTALL_CHROME" = 1 ]; then
        install_google_chrome || true
    fi

    if [ "$WITH_DEPS" = 1 ]; then
        if install_deps; then
            ok "host libraries installed for ${BROWSERS[*]}"
        elif [ "$WITH_WEBKIT" = 1 ]; then
            bad "WebKit remains unavailable until its host libraries are installed"
        fi
    elif [ -n "$SUDO" ] || [ "$(id -u)" = 0 ]; then
        # Libraries are the usual reason a browser cannot start, so try them
        # when root access is already possible without a prompt.
        if install_deps >/dev/null 2>&1; then
            ok "host libraries present for ${BROWSERS[*]}"
        else
            warn "some host libraries may be missing"
            note "run: sudo npx playwright install-deps ${BROWSERS[*]}"
        fi
    else
        warn "host libraries were not installed (needs root)"
        note "run: sudo npx playwright install-deps ${BROWSERS[*]}"
    fi
fi

if ! command -v google-chrome >/dev/null 2>&1; then
    warn "Google Chrome is not installed; the chrome-* projects use channel:\"chrome\""
    note "run: npm run setup:e2e -- --install-chrome"
else
    ok "Google Chrome: $(google-chrome --version 2>/dev/null | head -1)"
fi

if command -v opencode >/dev/null 2>&1; then
    ok "opencode: $(opencode --version 2>/dev/null | head -1) ${DIM}(used by npm run test:opencode)${RESET}"
else
    warn "opencode is not on PATH; only the opt-in local-agent scenario needs it"
    note "see https://opencode.ai for installation, then: npm run test:opencode"
fi

echo
if [ "$CHECK_ONLY" = 0 ]; then
    echo "Verifying launches and the test matrix…"
fi
check_args=(--check)
if [ "$WITH_WEBKIT" = 1 ]; then
    export E2E_WEBKIT=1
fi
if node scripts/analyze.mjs "${check_args[@]}"; then
    echo
    echo "${GREEN}Ready.${RESET} Run: npm run test:e2e"
else
    echo
    echo "${YELLOW}Environment is not fully ready.${RESET} Fix the entries marked above, then: npm run analyze:check"
    exit 1
fi
