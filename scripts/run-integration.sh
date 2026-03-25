#!/usr/bin/env bash
# scripts/run-integration.sh
# Full integration test: spin up stack, run tests, tear down.
#
# Usage:
#   ./scripts/run-integration.sh [--skip-build] [--keep-running]
#
# Requirements:
#   - Docker + Docker Compose
#   - Node.js 22 + pnpm
#   - Env vars or docker/api.env for API configuration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

SKIP_BUILD=false
KEEP_RUNNING=false
EXIT_CODE=0
COMPOSE_FILE="docker-compose.integration.yml"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --keep-running) KEEP_RUNNING=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

cleanup() {
  echo ""
  echo "=== Collecting logs ==="
  mkdir -p tmp/integration-logs
  docker compose -f "$COMPOSE_FILE" logs --no-color > tmp/integration-logs/docker-compose.log 2>&1 || true

  # Upload logs to S3 when running in CI
  if [[ -n "${CI:-}" && -n "${PSBT_ARCHIVE_BUCKET:-}" ]]; then
    local ts
    ts=$(date -u +%Y%m%dT%H%M%SZ)
    aws s3 cp tmp/integration-logs/ "s3://${PSBT_ARCHIVE_BUCKET}/integration-logs/${ts}/" --recursive 2>/dev/null || true
  fi

  # Kill DFNS mock if running
  if [[ -n "${MOCK_PID:-}" ]]; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi

  if [[ "$KEEP_RUNNING" != "true" ]]; then
    echo "=== Tearing down ==="
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  else
    echo "=== Stack left running (--keep-running) ==="
  fi

  echo ""
  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "=== INTEGRATION TESTS PASSED ==="
  else
    echo "=== INTEGRATION TESTS FAILED (exit code: $EXIT_CODE) ==="
    echo "Logs saved to: tmp/integration-logs/"
  fi

  exit $EXIT_CODE
}

trap cleanup EXIT

echo "=== Koya Integration Test Runner ==="
echo "Project: $PROJECT_DIR"
echo ""

# Step 1: Build
if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "=== [1/6] Building Docker images ==="
  docker compose -f "$COMPOSE_FILE" build
else
  echo "=== [1/6] Skipping build (--skip-build) ==="
fi

# Step 2: Start stack
echo ""
echo "=== [2/6] Starting integration stack ==="
docker compose -f "$COMPOSE_FILE" up -d --wait

# Step 3: Start DFNS mock
echo ""
echo "=== [3/6] Starting DFNS mock server ==="
export DFNS_MOCK_PORT=4444
export DFNS_MOCK_WEBHOOK_SECRET="${DFNS_MOCK_WEBHOOK_SECRET:-test-webhook-secret}"
export DFNS_MOCK_WEBHOOK_TARGET="http://localhost:3333/api/v1/dfns/webhook"
node scripts/dfns-mock/server.js &
MOCK_PID=$!
sleep 2

# Verify DFNS mock
if ! curl -sf "http://localhost:${DFNS_MOCK_PORT}/health" > /dev/null 2>&1; then
  echo "ERROR: DFNS mock server failed to start"
  EXIT_CODE=1
  exit 1
fi
echo "DFNS mock server running on port $DFNS_MOCK_PORT"

# Step 4: Wait for API
echo ""
echo "=== [4/6] Waiting for API health ==="
API_READY=false
for i in $(seq 1 30); do
  if curl -sf http://localhost:3333/api/v1/health > /dev/null 2>&1; then
    echo "API is ready"
    API_READY=true
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 2
done

if [[ "$API_READY" != "true" ]]; then
  echo "ERROR: API did not become ready within 60 seconds"
  EXIT_CODE=1
  exit 1
fi

# Step 5: Run integration tests
echo ""
echo "=== [5/6] Running integration tests ==="
if pnpm nx test api --testPathPattern="integration" --timeout 120000; then
  echo "Integration tests PASSED"
else
  EXIT_CODE=$?
  echo "Integration tests FAILED"
fi

# Step 6: Health checks
echo ""
echo "=== [6/6] Health checks ==="

# API health
API_HEALTH=$(curl -sf http://localhost:3333/api/v1/health 2>/dev/null || echo '{"status":"error"}')
echo "API health: $API_HEALTH"

# DFNS health (may not work without real DFNS config)
DFNS_HEALTH=$(curl -sf http://localhost:3333/internal/health/dfns 2>/dev/null || echo '{"status":"not_configured"}')
echo "DFNS health: $DFNS_HEALTH"

# DFNS mock health
MOCK_HEALTH=$(curl -sf "http://localhost:${DFNS_MOCK_PORT}/health" 2>/dev/null || echo '{"status":"error"}')
echo "DFNS mock health: $MOCK_HEALTH"

echo ""
echo "=== Test Results ==="
echo "Exit code: $EXIT_CODE"
echo "Logs: tmp/integration-logs/"
