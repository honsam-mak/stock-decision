#!/usr/bin/env bash
# Starts OpenSearch (if needed) and the application stack.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Creating .env from .env.example"
  cp .env.example .env
fi

if [ -z "$(docker ps -q -f name=^opensearch$)" ]; then
  echo "Starting OpenSearch..."
  docker start opensearch
  until curl -sf http://localhost:9200 >/dev/null; do
    echo "  waiting for OpenSearch..."
    sleep 3
  done
fi

docker compose up -d --build

echo
echo "App:      http://localhost:${FRONTEND_PORT:-8080}"
echo "API docs: http://localhost:${BACKEND_PORT:-8000}/docs"
