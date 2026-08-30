#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

if ! grep -qE '^SITE_PASSWORD=[^[:space:]]+' .env.local; then
  password="${SITE_PASSWORD:-kuato}"
  tmp="$(mktemp)"
  awk -v pw="$password" '
    BEGIN { done = 0 }
    /^SITE_PASSWORD=/ { print "SITE_PASSWORD=" pw; done = 1; next }
    { print }
    END { if (!done) print "SITE_PASSWORD=" pw }
  ' .env.local >"$tmp"
  mv "$tmp" .env.local
fi
