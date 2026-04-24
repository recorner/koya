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

normalize_network_mode() {
  local value
  value="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
  case "${value}" in
    mainnet|bitcoin) echo "mainnet" ;;
    testnet4|testnet) echo "testnet4" ;;
    signet) echo "signet" ;;
    regtest) echo "regtest" ;;
    *) echo "" ;;
  esac
}

normalize_bria_runtime_network() {
  local value
  value="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
  case "${value}" in
    mainnet|bitcoin) echo "bitcoin" ;;
    testnet|testnet4) echo "testnet" ;;
    signet) echo "signet" ;;
    regtest) echo "regtest" ;;
    *) echo "" ;;
  esac
}

derive_bria_network_from_policy() {
  local mode="$1"
  case "${mode}" in
    mainnet) echo "bitcoin" ;;
    testnet4) echo "testnet" ;;
    signet) echo "signet" ;;
    regtest) echo "regtest" ;;
    *) echo "" ;;
  esac
}

apply_btc_network_policy() {
  local policy_mode
  policy_mode="$(normalize_network_mode "${BTC_NETWORK:-}")"
  if [[ -z "${policy_mode}" ]]; then
    echo "ERROR: Invalid BTC_NETWORK='${BTC_NETWORK:-}'"
    return 1 2>/dev/null || exit 1
  fi

  if [[ "${ENVIRONMENT}" == "production" ]]; then
    local prod_mode
    prod_mode="$(normalize_network_mode "${BTC_PRODUCTION_NETWORK_MODE:-}")"
    if [[ -z "${prod_mode}" ]]; then
      prod_mode="testnet4"
      export BTC_PRODUCTION_NETWORK_MODE="${prod_mode}"
    fi
    policy_mode="${prod_mode}"
  fi

  local canonical_btc_network
  case "${policy_mode}" in
    mainnet) canonical_btc_network="bitcoin" ;;
    testnet4) canonical_btc_network="testnet4" ;;
    signet) canonical_btc_network="signet" ;;
    regtest) canonical_btc_network="regtest" ;;
    *) canonical_btc_network="bitcoin" ;;
  esac

  local runtime_bria_network
  runtime_bria_network="$(derive_bria_network_from_policy "${policy_mode}")"
  if [[ -z "${runtime_bria_network}" ]]; then
    echo "ERROR: Unable to derive BRIA runtime network for mode='${policy_mode}'"
    return 1 2>/dev/null || exit 1
  fi

  local configured_bria_runtime
  configured_bria_runtime="$(normalize_bria_runtime_network "${BRIA_NETWORK:-}")"
  if [[ -n "${configured_bria_runtime}" && "${configured_bria_runtime}" != "${runtime_bria_network}" ]]; then
    echo "ERROR: BTC/Bria network mismatch in env file (BTC mode=${policy_mode}, BRIA runtime=${configured_bria_runtime}, expected=${runtime_bria_network})"
    return 1 2>/dev/null || exit 1
  fi

  export BTC_NETWORK="${canonical_btc_network}"
  export BRIA_NETWORK="${runtime_bria_network}"

  if [[ "${ENVIRONMENT}" == "production" ]]; then
    export BTC_PRODUCTION_NETWORK_MODE="${policy_mode}"
  fi
}

apply_btc_network_policy

: "${BTC_PRODUCTION_NETWORK_MODE:=}"
export BTC_PRODUCTION_NETWORK_MODE

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
  BRIA_WALLET_NAME
  BRIA_ACCOUNT_NAME
  BRIA_SERVICE_PROFILE
  BRIA_PAYOUT_QUEUE
  BRIA_PAYOUT_QUEUE_NAME
  BRIA_XPUB_REF
  BRIA_SETUP_ENABLED
  MESSAGING_ENABLE_WHATSAPP_CLOUD
  MESSAGING_ENABLE_TELEGRAM
  MESSAGING_MAX_RETRIES
  MESSAGING_RETRY_BASE_MS
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_BUSINESS_ACCOUNT_ID
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
