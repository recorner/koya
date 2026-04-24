#!/usr/bin/env bash
set -euo pipefail

# validate-bootstrap.sh — Validate environment files, secrets map, and templates.
#
# Usage:
#   ./scripts/validate-bootstrap.sh [environment]
#   ./scripts/validate-bootstrap.sh              # Validate all environments
#   ./scripts/validate-bootstrap.sh staging       # Validate staging only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-all}"
ERRORS=0
WARNINGS=0

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  ⚠ $1"; WARNINGS=$((WARNINGS + 1)); }

# ── 1. Validate environment files ────────────────────────────────

echo ""
echo "=== Validating environment files ==="

REQUIRED_ENV_VARS=(
  AWS_REGION ENVIRONMENT PROJECT NODE_ENV PORT
  MPESA_DRIVER BTC_DELIVERY_DRIVER REDIS_HOST REDIS_PORT
  BTC_NETWORK BTC_PRODUCTION_NETWORK_MODE BRIA_NETWORK BRIA_ELECTRUM_URL
  BRIA_WALLET_NAME BRIA_ACCOUNT_NAME BRIA_SERVICE_PROFILE BRIA_PAYOUT_QUEUE BRIA_PAYOUT_QUEUE_NAME BRIA_XPUB_REF BRIA_SETUP_ENABLED
  MESSAGING_ENABLE_WHATSAPP_CLOUD MESSAGING_ENABLE_TELEGRAM
  MESSAGING_MAX_RETRIES MESSAGING_RETRY_BASE_MS
  WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID WHATSAPP_CLOUD_API_VERSION TELEGRAM_ALLOWED_IPS WHATSAPP_WEB_BASE_URL
  ECS_CLUSTER_NAME ECS_SERVICE_NAME API_TASK_FAMILY MIGRATE_TASK_FAMILY
  API_CPU API_MEMORY MIGRATE_CPU MIGRATE_MEMORY DESIRED_COUNT
  TRUST_PROXY_HOPS THROTTLE_DEFAULT_LIMIT
  AUTOSCALING_MIN_CAPACITY AUTOSCALING_MAX_CAPACITY
  WAF_GLOBAL_RATE_LIMIT
)

validate_env_file() {
  local env_name="$1"
  local env_file="${REPO_ROOT}/env/${env_name}.env"

  echo ""
  echo "  --- ${env_name} ---"

  if [[ ! -f "${env_file}" ]]; then
    fail "File not found: ${env_file}"
    return
  fi

  pass "File exists: ${env_file}"

  # Check for secrets (should not be in env files)
  if grep -qiE '(password|secret|token|key)=' "${env_file}" 2>/dev/null; then
    local suspicious
    suspicious=$(grep -iE '(password|secret|token|key)=' "${env_file}" | grep -v '^#' | grep -v 'PLACEHOLDER' || true)
    if [[ -n "${suspicious}" ]]; then
      warn "Possible secret in env file (verify these are non-secret):"
      echo "${suspicious}" | while read -r line; do echo "        ${line}"; done
    fi
  fi

  # Check required variables (skip some for integration)
  local missing=0
  for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [[ "${env_name}" == "integration" ]]; then
      # Integration doesn't need ECS vars
      case "${var}" in
        ECS_CLUSTER_NAME|ECS_SERVICE_NAME|API_TASK_FAMILY|MIGRATE_TASK_FAMILY) continue ;;
      esac
    fi

    if ! grep -q "^${var}=" "${env_file}" 2>/dev/null; then
      fail "Missing variable: ${var}"
      missing=$((missing + 1))
    fi
  done

  if [[ ${missing} -eq 0 ]]; then
    pass "All required variables present"
  fi

  # Check ENVIRONMENT matches filename
  local env_val
  env_val=$(grep "^ENVIRONMENT=" "${env_file}" | cut -d= -f2)
  if [[ "${env_val}" != "${env_name}" ]] && [[ "${env_name}" != "integration" || "${env_val}" != "integration" ]]; then
    fail "ENVIRONMENT=${env_val} does not match filename ${env_name}"
  fi
}

if [[ "${KOYA_ENV}" == "all" ]]; then
  for env in staging production integration; do
    validate_env_file "${env}"
  done
else
  validate_env_file "${KOYA_ENV}"
fi

# ── 2. Validate secrets map ──────────────────────────────────────

echo ""
echo "=== Validating secrets map ==="

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"

if [[ ! -f "${SECRETS_MAP}" ]]; then
  fail "Secrets map not found: ${SECRETS_MAP}"
else
  pass "Secrets map exists"

  # Check JSON validity
  if jq . "${SECRETS_MAP}" >/dev/null 2>&1; then
    pass "Valid JSON"
  else
    fail "Invalid JSON in secrets map"
  fi

  # Check required secrets
  REQUIRED_SECRETS=(
    DATABASE_URL REDIS_PASSWORD FX_API_KEY
    MPESA_CONSUMER_KEY MPESA_CONSUMER_SECRET MPESA_PASSKEY
    DFNS_API_KEY DFNS_WEBHOOK_SECRET BRIA_API_KEY
    WHATSAPP_APP_SECRET WHATSAPP_VERIFY_TOKEN WHATSAPP_ACCESS_TOKEN
    TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
  )

  for secret in "${REQUIRED_SECRETS[@]}"; do
    local_path=$(jq -r --arg s "${secret}" '.secrets[$s].path // empty' "${SECRETS_MAP}" 2>/dev/null)
    if [[ -z "${local_path}" ]]; then
      fail "Missing required secret: ${secret}"
    else
      pass "Secret defined: ${secret} → ${local_path}"
    fi
  done
fi

# ── 3. Validate task definition templates ────────────────────────

echo ""
echo "=== Validating task definition templates ==="

TEMPLATE_DIR="${REPO_ROOT}/infra/templates"

for tpl in ecs-task-definition.tpl.json ecs-migrate-task-definition.tpl.json; do
  tpl_path="${TEMPLATE_DIR}/${tpl}"

  if [[ ! -f "${tpl_path}" ]]; then
    fail "Template not found: ${tpl}"
    continue
  fi

  pass "Template exists: ${tpl}"

  # Check for placeholder variables
  placeholders=$(grep -oE '\$\{[A-Z_]+\}' "${tpl_path}" | sort -u || true)
  count=$(echo "${placeholders}" | wc -l)
  pass "Template has ${count} variables"

  # Check that critical placeholders are present
  if echo "${placeholders}" | grep -q 'EXECUTION_ROLE_ARN'; then
    pass "Has EXECUTION_ROLE_ARN placeholder"
  else
    fail "Missing EXECUTION_ROLE_ARN placeholder in ${tpl}"
  fi

  if echo "${placeholders}" | grep -q 'IMAGE_URI'; then
    pass "Has IMAGE_URI placeholder"
  else
    fail "Missing IMAGE_URI placeholder in ${tpl}"
  fi
done

# ── 4. Validate Terraform layer structure ────────────────────────

echo ""
echo "=== Validating Terraform layer structure ==="

for layer in foundation platform application; do
  layer_dir="${REPO_ROOT}/terraform/aws/${layer}"

  if [[ ! -d "${layer_dir}" ]]; then
    fail "Layer directory missing: ${layer}"
    continue
  fi

  pass "Layer exists: ${layer}/"

  # Check for required files
  for required_file in versions.tf variables.tf outputs.tf; do
    if [[ -f "${layer_dir}/${required_file}" ]]; then
      pass "${layer}/${required_file}"
    else
      fail "${layer}/${required_file} missing"
    fi
  done
done

# ── 5. Validate scripts are executable ───────────────────────────

echo ""
echo "=== Validating scripts ==="

for script in \
  bootstrap-aws.sh \
  deploy-api.sh \
  destroy-environment.sh \
  load-env.sh \
  sync-secrets.sh \
  render-task-definitions.sh \
  validate-bootstrap.sh \
  inspect-bria-lineage.sh \
  reprovision-bria-lineage.sh \
  verify-bria-runtime-lineage.sh \
  provision-bria-wallet.sh \
  validate-bria-address-family.sh; do
  script_path="${REPO_ROOT}/scripts/${script}"

  if [[ ! -f "${script_path}" ]]; then
    fail "Script missing: ${script}"
    continue
  fi

  if [[ -x "${script_path}" ]]; then
    pass "${script} (executable)"
  else
    fail "${script} (not executable)"
  fi
done

# ── Summary ──────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════"
echo "  Errors:   ${ERRORS}"
echo "  Warnings: ${WARNINGS}"
echo "═══════════════════════════════════════════════"

if [[ ${ERRORS} -gt 0 ]]; then
  echo ""
  echo "FAILED: Fix the errors above before proceeding."
  exit 1
else
  echo ""
  echo "PASSED: Bootstrap configuration is valid."
fi
