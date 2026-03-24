#!/usr/bin/env bash
# scripts/run-dfns-mock.sh
# Start the DFNS mock server in the background.
#
# Usage:
#   ./scripts/run-dfns-mock.sh [--port 4444] [--webhook-target http://localhost:3333/api/v1/dfns/webhook]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOCK_DIR="${SCRIPT_DIR}/dfns-mock"

export DFNS_MOCK_PORT="${DFNS_MOCK_PORT:-4444}"
export DFNS_MOCK_WEBHOOK_TARGET="${DFNS_MOCK_WEBHOOK_TARGET:-http://localhost:3333/api/v1/dfns/webhook}"
export DFNS_MOCK_WEBHOOK_SECRET="${DFNS_MOCK_WEBHOOK_SECRET:-test-webhook-secret}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) DFNS_MOCK_PORT="$2"; shift 2 ;;
    --webhook-target) DFNS_MOCK_WEBHOOK_TARGET="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "Starting DFNS mock server..."
echo "  Port: $DFNS_MOCK_PORT"
echo "  Webhook target: $DFNS_MOCK_WEBHOOK_TARGET"

node "${MOCK_DIR}/server.js" &
MOCK_PID=$!
echo "  PID: $MOCK_PID"

# Wait for server to be ready
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${DFNS_MOCK_PORT}/health" > /dev/null 2>&1; then
    echo "DFNS mock server is ready"
    exit 0
  fi
  sleep 0.5
done

echo "ERROR: DFNS mock server failed to start"
kill "$MOCK_PID" 2>/dev/null || true
exit 1
