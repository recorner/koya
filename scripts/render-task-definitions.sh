#!/usr/bin/env bash
set -euo pipefail

# render-task-definitions.sh — Render ECS task definition JSON from templates.
#
# Usage:
#   ./scripts/render-task-definitions.sh <environment> [image-tag] [--live-ecs] [--cluster <name>] [--service <name>]
#
# Reads:
#   - env/<environment>.env (non-secret config)
#   - Terraform outputs (role ARNs, secret ARNs, log groups)
#   - infra/templates/ecs-task-definition.tpl.json
#   - infra/templates/ecs-migrate-task-definition.tpl.json
#
# Writes:
#   - infra/rendered/ecs-task-definition.json
#   - infra/rendered/ecs-migrate-task-definition.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-}"
IMAGE_TAG="latest"
LIVE_ECS_MODE=false
LIVE_CLUSTER="${LIVE_ECS_CLUSTER:-}"
LIVE_SERVICE="${LIVE_ECS_SERVICE:-}"

shift || true

if [[ $# -gt 0 ]] && [[ "${1:-}" != --* ]]; then
  IMAGE_TAG="${1}"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --live-ecs)
      LIVE_ECS_MODE=true
      shift
      ;;
    --cluster)
      LIVE_CLUSTER="${2:-}"
      shift 2
      ;;
    --service)
      LIVE_SERVICE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown option: ${1}"
      exit 1
      ;;
  esac
done

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/render-task-definitions.sh <staging|production> [image-tag] [--live-ecs] [--cluster <name>] [--service <name>]"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

# Requires jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required."
  exit 1
fi

if ! command -v envsubst &>/dev/null; then
  echo "ERROR: envsubst is required."
  exit 1
fi

export BRIA_STREAM_RECONNECT_BASE_MS="${BRIA_STREAM_RECONNECT_BASE_MS:-1000}"
export BRIA_STREAM_RECONNECT_MAX_MS="${BRIA_STREAM_RECONNECT_MAX_MS:-30000}"
export BRIA_STREAM_RECONNECT_JITTER_MS="${BRIA_STREAM_RECONNECT_JITTER_MS:-500}"

normalize_ecr_repo_url() {
  local image="$1"
  local repo="${image%@*}"
  if [[ "${repo}" == *:* ]]; then
    repo="${repo%:*}"
  fi
  echo "${repo}"
}

resolve_live_task_definition_arn() {
  local running_task_arns
  running_task_arns=$(aws ecs list-tasks \
    --cluster "${LIVE_CLUSTER}" \
    --service-name "${LIVE_SERVICE}" \
    --desired-status RUNNING \
    --region "${AWS_REGION}" \
    --query 'taskArns' \
    --output text 2>/dev/null || true)

  if [[ -n "${running_task_arns}" ]] && [[ "${running_task_arns}" != "None" ]]; then
    local running_task_def_arn
    running_task_def_arn=$(aws ecs describe-tasks \
      --cluster "${LIVE_CLUSTER}" \
      --tasks ${running_task_arns} \
      --region "${AWS_REGION}" \
      --query 'sort_by(tasks, &startedAt)[0].taskDefinitionArn' \
      --output text 2>/dev/null || true)
    if [[ -n "${running_task_def_arn}" ]] && [[ "${running_task_def_arn}" != "None" ]]; then
      echo "${running_task_def_arn}"
      return
    fi
  fi

  aws ecs describe-services \
    --cluster "${LIVE_CLUSTER}" \
    --services "${LIVE_SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' \
    --output text 2>/dev/null || true
}

set_from_current_env() {
  local key="$1"
  local mode="${2:-if-missing}"
  local existing="${!key:-}"
  if [[ "${mode}" == "if-missing" ]] && [[ -n "${existing}" ]]; then
    return
  fi

  local value
  value=$(jq -r --arg key "${key}" '.containerDefinitions[0].environment[]? | select(.name == $key) | .value' <<< "${CURRENT_TASK_DEF_JSON}" | head -n1)
  if [[ -n "${value}" ]] && [[ "${value}" != "null" ]]; then
    export "${key}=${value}"
    if [[ "${mode}" == "force" ]]; then
      echo "  Carrying forward ${key} from live runtime"
    else
      echo "  Carrying forward ${key} from live runtime (missing in env file)"
    fi
  fi
}

# ── Resolve infrastructure values ────────────────────────────────

TF_FOUNDATION_DIR="${REPO_ROOT}/terraform/aws/foundation"
TF_PLATFORM_DIR="${REPO_ROOT}/terraform/aws/platform"

get_tf_output() {
  local dir="$1"
  local key="$2"
  terraform -chdir="${dir}" output -raw "${key}" 2>/dev/null || echo ""
}

if [[ "${LIVE_ECS_MODE}" == "true" ]]; then
  echo ""
  echo "=== Resolving infrastructure from live ECS service ==="

  if [[ -z "${LIVE_CLUSTER}" || -z "${LIVE_SERVICE}" ]]; then
    echo "ERROR: --live-ecs requires cluster/service (flags or LIVE_ECS_CLUSTER/LIVE_ECS_SERVICE)."
    exit 1
  fi

  CURRENT_TASK_DEF_ARN=$(resolve_live_task_definition_arn)

  if [[ -z "${CURRENT_TASK_DEF_ARN}" ]] || [[ "${CURRENT_TASK_DEF_ARN}" == "None" ]]; then
    echo "ERROR: Could not resolve current task definition from ${LIVE_CLUSTER}/${LIVE_SERVICE}."
    exit 1
  fi

  CURRENT_TASK_DEF_JSON=$(aws ecs describe-task-definition \
    --task-definition "${CURRENT_TASK_DEF_ARN}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' \
    --output json)

  EXECUTION_ROLE_ARN=$(jq -r '.executionRoleArn // empty' <<< "${CURRENT_TASK_DEF_JSON}")
  API_TASK_ROLE_ARN=$(jq -r '.taskRoleArn // empty' <<< "${CURRENT_TASK_DEF_JSON}")
  MIGRATE_TASK_ROLE_ARN="${LIVE_MIGRATE_TASK_ROLE_ARN:-${API_TASK_ROLE_ARN}}"
  LOG_GROUP_NAME=$(jq -r '.containerDefinitions[0].logConfiguration.options["awslogs-group"] // empty' <<< "${CURRENT_TASK_DEF_JSON}")
  CURRENT_IMAGE=$(jq -r '.containerDefinitions[0].image // empty' <<< "${CURRENT_TASK_DEF_JSON}")
  CURRENT_FAMILY=$(jq -r '.family // empty' <<< "${CURRENT_TASK_DEF_JSON}")
  ECR_REPO_URL=$(normalize_ecr_repo_url "${CURRENT_IMAGE}")

  if [[ "${LIVE_USE_SERVICE_TASK_FAMILIES:-true}" == "true" ]] && [[ -n "${CURRENT_FAMILY}" ]]; then
    export API_TASK_FAMILY="${CURRENT_FAMILY}"
    export MIGRATE_TASK_FAMILY="${CURRENT_FAMILY}-migrate"
    echo "  Using live task families: API=${API_TASK_FAMILY} MIGRATE=${MIGRATE_TASK_FAMILY}"
  fi

  # Drift-safe live mode:
  # Preserve runtime connectivity/payment values from the currently running task
  # so deploys can roll forward safely even if env/<env>.env differs.
  for key in \
    REDIS_HOST \
    REDIS_PORT \
    REDIS_TLS \
    REDIS_DB \
    MPESA_ENVIRONMENT \
    BTC_DELIVERY_DRIVER \
    BTC_NETWORK \
    BRIA_API_HOST \
    BRIA_API_PORT \
    BRIA_NETWORK \
    BRIA_ELECTRUM_URL \
    BRIA_WALLET_NAME \
    BRIA_XPUB_REF \
    BRIA_STREAM_RECONNECT_BASE_MS \
    BRIA_STREAM_RECONNECT_MAX_MS \
    BRIA_STREAM_RECONNECT_JITTER_MS \
    DFNS_API_URL \
    DFNS_APP_ID \
    DFNS_WALLET_ID \
    BRIA_PAYOUT_QUEUE \
    BRIA_PAYOUT_QUEUE_NAME \
    DFNS_SERVICE_ACCOUNT; do
    set_from_current_env "${key}" "force"
  done
else
  echo ""
  echo "=== Resolving Terraform outputs ==="

  # Foundation outputs
  EXECUTION_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "ecs_execution_role_arn")
  API_TASK_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "api_task_role_arn")
  MIGRATE_TASK_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "migrate_task_role_arn")
  LOG_GROUP_NAME=$(get_tf_output "${TF_FOUNDATION_DIR}" "api_log_group_name")

  # Platform outputs
  ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM_DIR}" "ecr_repository_url")
fi

# Build image URI
export IMAGE_URI="${ECR_REPO_URL}:${IMAGE_TAG}"

for var_name in EXECUTION_ROLE_ARN API_TASK_ROLE_ARN MIGRATE_TASK_ROLE_ARN LOG_GROUP_NAME ECR_REPO_URL; do
  if [[ -z "${!var_name}" ]]; then
    echo "ERROR: Missing required infrastructure value: ${var_name}"
    exit 1
  fi
done

# ── Resolve secret ARNs ─────────────────────────────────────────

echo "=== Resolving secret ARNs ==="

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"

if [[ ! -f "${SECRETS_MAP}" ]]; then
  echo "ERROR: Secrets map not found: ${SECRETS_MAP}"
  exit 1
fi

resolve_secret_arn() {
  local logical_name="$1"
  local path
  path=$(jq -r --arg name "${logical_name}" '.secrets[$name].path // empty' "${SECRETS_MAP}")

  if [[ -z "${path}" ]]; then
    echo "ERROR: Secret ${logical_name} not in secrets map" >&2
    return 1
  fi

  local arn
  arn=$(aws secretsmanager describe-secret \
    --secret-id "${path}" \
    --region "${AWS_REGION}" \
    --query 'ARN' \
    --output text 2>/dev/null || true)

  if [[ -z "${arn}" ]] || [[ "${arn}" == "None" ]]; then
    echo "ERROR: Could not resolve ARN for ${logical_name} at path ${path}" >&2
    return 1
  fi

  echo "${arn}"
}

set_secret_arn_env() {
  local logical_name="$1"
  local env_name="$2"
  local arn
  arn=$(resolve_secret_arn "${logical_name}")
  export "${env_name}=${arn}"
}

set_secret_arn_env "DATABASE_URL" "SECRET_ARN_DATABASE_URL"
set_secret_arn_env "REDIS_PASSWORD" "SECRET_ARN_REDIS_PASSWORD"
set_secret_arn_env "MPESA_CONSUMER_KEY" "SECRET_ARN_MPESA_CONSUMER_KEY"
set_secret_arn_env "MPESA_CONSUMER_SECRET" "SECRET_ARN_MPESA_CONSUMER_SECRET"
set_secret_arn_env "MPESA_PASSKEY" "SECRET_ARN_MPESA_PASSKEY"
set_secret_arn_env "DFNS_API_KEY" "SECRET_ARN_DFNS_API_KEY"
set_secret_arn_env "DFNS_WEBHOOK_SECRET" "SECRET_ARN_DFNS_WEBHOOK_SECRET"
set_secret_arn_env "BRIA_API_KEY" "SECRET_ARN_BRIA_API_KEY"
set_secret_arn_env "FX_API_KEY" "SECRET_ARN_FX_API_KEY"
set_secret_arn_env "WHATSAPP_APP_SECRET" "SECRET_ARN_WHATSAPP_APP_SECRET"
set_secret_arn_env "WHATSAPP_VERIFY_TOKEN" "SECRET_ARN_WHATSAPP_VERIFY_TOKEN"
set_secret_arn_env "WHATSAPP_ACCESS_TOKEN" "SECRET_ARN_WHATSAPP_ACCESS_TOKEN"
set_secret_arn_env "TELEGRAM_BOT_TOKEN" "SECRET_ARN_TELEGRAM_BOT_TOKEN"
set_secret_arn_env "TELEGRAM_WEBHOOK_SECRET" "SECRET_ARN_TELEGRAM_WEBHOOK_SECRET"

# ── Export all needed vars ───────────────────────────────────────

export EXECUTION_ROLE_ARN
export API_TASK_ROLE_ARN
export MIGRATE_TASK_ROLE_ARN
export LOG_GROUP_NAME

# ── Render templates ─────────────────────────────────────────────

echo "=== Rendering task definitions ==="

TEMPLATE_DIR="${REPO_ROOT}/infra/templates"
OUTPUT_DIR="${REPO_ROOT}/infra/rendered"
mkdir -p "${OUTPUT_DIR}"

render_template() {
  local template="$1"
  local output="$2"

  # Use envsubst to replace ${VAR} placeholders
  envsubst < "${template}" > "${output}"

  # Validate JSON
  if jq . "${output}" >/dev/null 2>&1; then
    echo "  ✓ Rendered: ${output}"
  else
    echo "  ERROR: Invalid JSON in ${output}"
    exit 1
  fi
}

render_template \
  "${TEMPLATE_DIR}/ecs-task-definition.tpl.json" \
  "${OUTPUT_DIR}/ecs-task-definition.json"

render_template \
  "${TEMPLATE_DIR}/ecs-migrate-task-definition.tpl.json" \
  "${OUTPUT_DIR}/ecs-migrate-task-definition.json"

echo ""
echo "=== Rendered task definitions ==="
echo "  API:     ${OUTPUT_DIR}/ecs-task-definition.json"
echo "  Migrate: ${OUTPUT_DIR}/ecs-migrate-task-definition.json"
