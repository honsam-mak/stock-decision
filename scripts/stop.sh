#!/usr/bin/env bash
# Stops the application stack. OpenSearch is left running because other
# projects on this machine share it; pass --with-opensearch to stop it too.
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose down

if [ "${1:-}" = "--with-opensearch" ]; then
  echo "Stopping OpenSearch..."
  docker stop opensearch
fi

echo "Stopped. Data is preserved in OpenSearch."
