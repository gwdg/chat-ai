#!/usr/bin/env bash
# Runs the deterministic Playwright suite with the combinations used most often.
# It only builds the `npx playwright test` command, so everything Playwright
# supports after `--` still works.
#
#   bash scripts/run-tests.sh                          # every spec, chrome-desktop
#   bash scripts/run-tests.sh --all                    # all four device projects
#   bash scripts/run-tests.sh --phone --tablet         # two projects
#   bash scripts/run-tests.sh tests/tutorial-backup-restore.spec.ts --all
#   bash scripts/run-tests.sh --gated                  # lean build, :8094
#   bash scripts/run-tests.sh --headed -- --grep tutorial
#
# Projects: --desktop (default), --tablet, --phone, --firefox, --all.
# --gated runs the `tutorial-gated` project only (its own Vite server on :8094).
# Documentation screenshots go to results/documentation/<spec>/<project>/.
set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

projects=()
specs=()
passthrough=()
headed=0
ui=0
gated=0
projects_given=0

add_projects() {
    projects_given=1
    for name in "$@"; do
        case " ${projects[*]-} " in
            *" $name "*) ;;
            *) projects+=("$name") ;;
        esac
    done
}

while [ $# -gt 0 ]; do
    case "$1" in
        --desktop) add_projects chrome-desktop ;;
        --tablet) add_projects chrome-tablet ;;
        --phone) add_projects chrome-phone ;;
        --firefox) add_projects firefox-desktop ;;
        --all) add_projects chrome-desktop chrome-tablet chrome-phone firefox-desktop ;;
        --gated) gated=1 ;;
        --headed) headed=1 ;;
        --ui) ui=1 ;;
        --help|-h) usage; exit 0 ;;
        --)
            shift
            passthrough+=("$@")
            break
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage
            exit 2
            ;;
        *) specs+=("$1") ;;
    esac
    shift
done

if [ "$gated" = 1 ]; then
    if [ "$projects_given" = 1 ]; then
        echo "--gated runs its own project; do not combine it with device flags." >&2
        exit 2
    fi
    projects=(tutorial-gated)
elif [ "$projects_given" = 0 ]; then
    projects=(chrome-desktop)
fi

if [ ! -x node_modules/.bin/playwright ]; then
    echo "e2e dependencies are missing. Run: npm i && npm run setup:e2e" >&2
    exit 1
fi

cmd=(npx playwright test)
for project in "${projects[@]}"; do
    cmd+=("--project=$project")
done
if [ "$headed" = 1 ]; then cmd+=(--headed); fi
if [ "$ui" = 1 ]; then cmd+=(--ui); fi
cmd+=(${specs[@]+"${specs[@]}"})
cmd+=(${passthrough[@]+"${passthrough[@]}"})

echo "+ ${cmd[*]}"
exec "${cmd[@]}"
