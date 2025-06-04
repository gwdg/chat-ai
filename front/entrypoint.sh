#!/bin/bash
set -e

# Read the config.json file
CONFIG=$(cat /run/secrets/front)

# Extract the mode using jq (install jq if not already present)
MODE=$(echo "$CONFIG" | jq -r '.mode')

# Determine the command to run
if [ "$MODE" == "dev" ]; then
  npm run dev
elif [ "$MODE" == "prod" ]; then
  npm run prod
else
  echo "Invalid mode in front.json. Must be 'dev' or 'prod'."
  exit 1
fi