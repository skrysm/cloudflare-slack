#!/usr/bin/env bash
set -euo pipefail

SUBDOMAIN="${1:-}"
TEXT="${2:-}"
if [[ -z "$SUBDOMAIN" || -z "$TEXT" ]]; then
  echo "Usage: $0 <subdomain> \"message text\"" >&2
  exit 1
fi

WORKER_URL="https://notify.${SUBDOMAIN}.workers.dev"

read -r -s -p "Shared password: " PASSWORD
echo
if [[ -z "$PASSWORD" ]]; then
  echo "Password is required." >&2
  exit 1
fi

curl -sS --fail-with-body \
  -H "X-Shared-Password: ${PASSWORD}" \
  --get \
  --data-urlencode "text=${TEXT}" \
  "${WORKER_URL}"
