#!/bin/sh
set -eu

ADDRESS="${TEMPORAL_ADDRESS:-temporal:7233}"

for ns in workflow-orchestration-platform-temporal-platform-dev workflow-orchestration-platform-temporal-platform-prod; do
  if tctl --address "$ADDRESS" --namespace "$ns" namespace describe >/dev/null 2>&1; then
    echo "namespace '$ns' already registered"
  else
    echo "registering namespace '$ns'"
    tctl --address "$ADDRESS" --namespace "$ns" namespace register --retention 3
  fi
done

tail -f /dev/null
