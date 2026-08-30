#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d node_modules ]]; then
  bash .devcontainer/post-create.sh
fi

if [[ ! -f .env.local ]]; then
  bash .devcontainer/post-create.sh
fi

if (echo >/dev/tcp/127.0.0.1/3000) >/dev/null 2>&1; then
  echo "Kuato is already listening on port 3000."
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
