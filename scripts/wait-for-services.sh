#!/usr/bin/env bash
# scripts/wait-for-services.sh
# Wait for integration stack services to become healthy.
#
# Usage:
#   ./scripts/wait-for-services.sh [--timeout 120]
#
# Checks: API (:3333), Redis (:6379), Bria gRPC (:2742)

set -euo pipefail

TIMEOUT="${1:-120}"
START_TIME=$(date +%s)

wait_for() {
  local name="$1"
  local check_cmd="$2"

  echo "Waiting for ${name}..."
  while true; do
    ELAPSED=$(( $(date +%s) - START_TIME ))
    if [[ $ELAPSED -ge $TIMEOUT ]]; then
      echo "ERROR: Timed out after ${TIMEOUT}s waiting for ${name}"
      exit 1
    fi

    if eval "$check_cmd" > /dev/null 2>&1; then
      echo "  ${name} is ready (${ELAPSED}s)"
      return 0
    fi
    sleep 2
  done
}

echo "=== Waiting for integration services (timeout: ${TIMEOUT}s) ==="

wait_for "Redis" "redis-cli -h localhost -p 6379 ping 2>/dev/null || nc -z localhost 6379"
wait_for "Bria gRPC" "nc -z localhost 2742"
wait_for "API" "curl -sf http://localhost:3333/api/v1/health"

echo "=== All services ready ==="
