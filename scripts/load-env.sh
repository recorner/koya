#!/usr/bin/env bash
set -euo pipefail

# load-env.sh — Load and validate a Koya environment file.
#
# Usage:
#   source scripts/load-env.sh staging
#   source scripts/load-env.sh production
#   source scripts/load-env.sh integration
#
# Exports all variables from env/<environment>.env and validates
# that required variables are present.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Args ─────────────────────────────────────────────────────────

KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "ERROR: Environment name required."
  echo "Usage: source scripts/load-env.sh <staging|production|integration>"
  return 1 2>/dev/null || exit 1
fi

ENV_FILE="${REPO_ROOT}/env/${KOYA_ENV}.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: Environment file not found: ${ENV_FILE}"
  return 1 2>/dev/null || exit 1
fi

# ── Load ─────────────────────────────────────────────────────────

echo "Loading environment: ${KOYA_ENV} (${ENV_FILE})"

while IFS= read -r line || [[ -n "${line}" ]]; do
  # Skip comments and empty lines
  [[ -z "${line}" ]] && continue
  [[ "${line}" =~ ^[[:space:]]*# ]] && continue

  # Export the variable
  export "${line?}"
done < "${ENV_FILE}"

# ── Validate required variables ──────────────────────────────────

REQUIRED_VARS=(
  AWS_REGION
  ENVIRONMENT
  PROJECT
  NODE_ENV
  PORT
  BTC_NETWORK
  BRIA_NETWORK
  BRIA_ELECTRUM_URL
  MESSAGING_ENABLE_WHATSAPP_CLOUD
  MESSAGING_ENABLE_TELEGRAM
  MESSAGING_MAX_RETRIES
  MESSAGING_RETRY_BASE_MS
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_CLOUD_API_VERSION
  WHATSAPP_WEB_BASE_URL
)

# For non-integration environments, also require AWS infra vars
if [[ "${KOYA_ENV}" != "integration" ]]; then
  REQUIRED_VARS+=(
    TF_STATE_BUCKET
    ECS_CLUSTER_NAME
    ECS_SERVICE_NAME
    API_TASK_FAMILY
    MIGRATE_TASK_FAMILY
  )
fi

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("${var}")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required environment variables:"
  for var in "${MISSING[@]}"; do
    echo "  - ${var}"
  done
  return 1 2>/dev/null || exit 1
fi

echo "Environment loaded: ENVIRONMENT=${ENVIRONMENT}, AWS_REGION=${AWS_REGION}, PROJECT=${PROJECT}"
