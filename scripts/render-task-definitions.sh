#!/usr/bin/env bash
set -euo pipefail

# render-task-definitions.sh — Render ECS task definition JSON from templates.
#
# Usage:
#   ./scripts/render-task-definitions.sh <environment> [image-tag]
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
IMAGE_TAG="${2:-latest}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/render-task-definitions.sh <staging|production> [image-tag]"
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

# ── Resolve Terraform outputs ────────────────────────────────────

echo ""
echo "=== Resolving Terraform outputs ==="

TF_FOUNDATION_DIR="${REPO_ROOT}/terraform/aws/foundation"
TF_PLATFORM_DIR="${REPO_ROOT}/terraform/aws/platform"

get_tf_output() {
  local dir="$1"
  local key="$2"
  terraform -chdir="${dir}" output -raw "${key}" 2>/dev/null || echo ""
}

# Foundation outputs
EXECUTION_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "ecs_execution_role_arn")
API_TASK_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "api_task_role_arn")
MIGRATE_TASK_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "migrate_task_role_arn")
LOG_GROUP_NAME=$(get_tf_output "${TF_FOUNDATION_DIR}" "api_log_group_name")
AWS_ACCOUNT_ID=$(get_tf_output "${TF_FOUNDATION_DIR}" "aws_account_id")

# Platform outputs
ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM_DIR}" "ecr_repository_url")

# Build image URI
export IMAGE_URI="${ECR_REPO_URL}:${IMAGE_TAG}"

# ── Resolve secret ARNs ─────────────────────────────────────────

echo "=== Resolving secret ARNs ==="

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"

resolve_secret_arn() {
  local logical_name="$1"
  local path
  path=$(jq -r --arg name "${logical_name}" '.secrets[$name].path // empty' "${SECRETS_MAP}")

  if [[ -z "${path}" ]]; then
    echo "ERROR: Secret ${logical_name} not in secrets map" >&2
    return 1
  fi

  aws secretsmanager describe-secret \
    --secret-id "${path}" \
    --region "${AWS_REGION}" \
    --query 'ARN' \
    --output text 2>/dev/null || echo ""
}

export SECRET_ARN_DATABASE_URL=$(resolve_secret_arn "DATABASE_URL")
export SECRET_ARN_REDIS_PASSWORD=$(resolve_secret_arn "REDIS_PASSWORD")
export SECRET_ARN_MPESA_CONSUMER_KEY=$(resolve_secret_arn "MPESA_CONSUMER_KEY")
export SECRET_ARN_MPESA_CONSUMER_SECRET=$(resolve_secret_arn "MPESA_CONSUMER_SECRET")
export SECRET_ARN_MPESA_PASSKEY=$(resolve_secret_arn "MPESA_PASSKEY")
export SECRET_ARN_DFNS_API_KEY=$(resolve_secret_arn "DFNS_API_KEY")
export SECRET_ARN_DFNS_WEBHOOK_SECRET=$(resolve_secret_arn "DFNS_WEBHOOK_SECRET")
export SECRET_ARN_BRIA_API_KEY=$(resolve_secret_arn "BRIA_API_KEY")
export SECRET_ARN_FX_API_KEY=$(resolve_secret_arn "FX_API_KEY")

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
