#!/bin/bash
set -e

# Read the config.json file
CONFIG=$(cat /run/secrets/front)

# Extract the mode using bash string manipulation, handling variable spacing
MODE=$(echo "$CONFIG" | grep -oP '"mode"\s*:\s*"\K[^"]+')

# docker-compose.yml keeps node_modules on its own volume, which survives a
# rebuilt image. After a `git pull` that adds or bumps a package, that volume
# still holds the old tree; a build from it writes its chunks before it reports
# the unresolved import, so the web server ends up with a bundle that fails in
# the browser ("Failed to resolve module specifier ..."). Reinstall when the
# lockfile moved.
ensure_dependencies() {
  local stamp=node_modules/.chat-ai-lock-sha
  local sha
  sha=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$sha" ]; then
    echo "Dependencies do not match package-lock.json; running npm ci"
    npm ci --no-audit --no-fund
    echo "$sha" > "$stamp"
  fi
}

# vite empties its output directory before rendering, so a failed build leaves
# a half-written bundle behind for the web server to serve. Build beside dist
# and swap only after the build succeeded.
build_atomically() {
  rm -rf dist.next dist.old
  npm run build -- --outDir dist.next
  if [ ! -f dist.next/index.html ]; then
    echo "Build produced no bundle in dist.next"
    return 1
  fi
  if [ -d dist ]; then mv dist dist.old; fi
  if ! mv dist.next dist; then
    if [ -d dist.old ]; then mv dist.old dist; fi
    return 1
  fi
  rm -rf dist.old
}

ensure_dependencies

# Determine the command to run
if [ "$MODE" == "dev" ]; then
  npm run dev
elif [ "$MODE" == "prod" ]; then
  build_atomically
  npm run preview
elif [ "$MODE" == "build" ]; then
  build_atomically
else
  echo "Invalid mode in front.json. Must be 'dev' or 'prod' or 'build'."
  exit 1
fi
