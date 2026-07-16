#!/bin/sh
set -eu

ADDRESS="${1:-localhost:7233}"
TRIES=30

for i in $(seq 1 "$TRIES"); do
  if docker compose --project-directory . -f docker/docker-compose.yml exec -T temporal tctl --address "$ADDRESS" cluster health >/dev/null 2>&1; then
    echo "temporal is healthy"
    exit 0
  fi
  echo "waiting for temporal ($i/$TRIES)..."
  sleep 2
done

echo "temporal did not become healthy in time" >&2
exit 1
