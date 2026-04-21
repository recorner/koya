#!/usr/bin/env bash
set -euo pipefail

# render-bria-task-definition.sh — Render Bria ECS task definition JSON.
#
# Usage:
#   ./scripts/render-bria-task-definition.sh <environment> [image-tag]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-}"
IMAGE_TAG="${2:-latest}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/render-bria-task-definition.sh <staging|production> [image-tag]"
  exit 1
fi

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required."
  exit 1
fi

if ! command -v envsubst &>/dev/null; then
  echo "ERROR: envsubst is required."
  exit 1
fi

TF_FOUNDATION_DIR="${REPO_ROOT}/terraform/aws/foundation"
TF_PLATFORM_DIR="${REPO_ROOT}/terraform/aws/platform"

get_tf_output() {
  local dir="$1"
  local key="$2"
  terraform -chdir="${dir}" output -raw "${key}" 2>/dev/null || echo ""
}

EXECUTION_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "ecs_execution_role_arn")
BRIA_TASK_ROLE_ARN=$(get_tf_output "${TF_FOUNDATION_DIR}" "bria_task_role_arn")
BRIA_LOG_GROUP_NAME=$(get_tf_output "${TF_FOUNDATION_DIR}" "bria_log_group_name")
BRIA_ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM_DIR}" "ecr_bria_repository_url")

if [[ -z "${BRIA_ECR_REPO_URL}" ]]; then
  API_ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM_DIR}" "ecr_repository_url")
  if [[ -n "${API_ECR_REPO_URL}" ]]; then
    BRIA_ECR_REPO_URL="${API_ECR_REPO_URL%/api}/bria"
  fi
fi

for var_name in EXECUTION_ROLE_ARN BRIA_TASK_ROLE_ARN BRIA_LOG_GROUP_NAME BRIA_ECR_REPO_URL; do
  if [[ -z "${!var_name}" ]]; then
    echo "ERROR: Missing required infrastructure value: ${var_name}"
    exit 1
  fi
done

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

SECRET_ARN_BRIA_PG_CONNECTION=$(resolve_secret_arn "BRIA_PG_CONNECTION")
SECRET_ARN_BRIA_SIGNER_ENCRYPTION_KEY=$(resolve_secret_arn "BRIA_SIGNER_ENCRYPTION_KEY")

export EXECUTION_ROLE_ARN
export BRIA_TASK_ROLE_ARN
export BRIA_LOG_GROUP_NAME
export SECRET_ARN_BRIA_PG_CONNECTION
export SECRET_ARN_BRIA_SIGNER_ENCRYPTION_KEY
export BRIA_IMAGE_URI="${BRIA_ECR_REPO_URL}:${IMAGE_TAG}"

export BRIA_TASK_FAMILY="${BRIA_TASK_FAMILY:-${PROJECT}-bria-${ENVIRONMENT}}"
export BRIA_CPU="${BRIA_CPU:-512}"
export BRIA_MEMORY="${BRIA_MEMORY:-1024}"
export BRIA_PORT="${BRIA_PORT:-2742}"
export BRIA_ADMIN_PORT="${BRIA_ADMIN_PORT:-2743}"
export BRIA_NETWORK="${BRIA_NETWORK:-testnet4}"
export BRIA_ELECTRUM_URL="${BRIA_ELECTRUM_URL:-mempool.space:40002}"

TEMPLATE_DIR="${REPO_ROOT}/infra/templates"
OUTPUT_DIR="${REPO_ROOT}/infra/rendered"
mkdir -p "${OUTPUT_DIR}"

OUTPUT_PATH="${OUTPUT_DIR}/ecs-bria-task-definition.json"
envsubst < "${TEMPLATE_DIR}/ecs-bria-task-definition.tpl.json" > "${OUTPUT_PATH}"

if ! jq . "${OUTPUT_PATH}" >/dev/null 2>&1; then
  echo "ERROR: Invalid JSON in ${OUTPUT_PATH}"
  exit 1
fi

echo "Rendered Bria task definition: ${OUTPUT_PATH}"
