#!/bin/bash
set -e

# Read the config.json file
CONFIG=$(cat /run/secrets/front)

# Extract the mode using bash string manipulation, handling variable spacing
MODE=$(echo "$CONFIG" | grep -oP '"mode"\s*:\s*"\K[^"]+')

# Determine the command to run
if [ "$MODE" == "dev" ]; then
  npm run dev
elif [ "$MODE" == "prod" ]; then
  npm run prod
elif [ "$MODE" == "build" ]; then
  npm run build
else
  echo "Invalid mode in front.json. Must be 'dev' or 'prod' or 'build'."
  exit 1
fi