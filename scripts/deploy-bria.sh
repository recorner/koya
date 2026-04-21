#!/usr/bin/env bash
set -euo pipefail

# deploy-bria.sh — Build/push, register task definition, and roll Bria ECS service.
#
# Usage:
#   ./scripts/deploy-bria.sh <environment> [image-tag] [--build]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-}"
IMAGE_TAG="latest"
BUILD_IMAGE=false

shift || true

if [[ $# -gt 0 ]] && [[ "${1:-}" != --* ]]; then
  IMAGE_TAG="${1}"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --build)
      BUILD_IMAGE=true
      shift
      ;;
    *)
      echo "Unknown option: ${1}"
      exit 1
      ;;
  esac
done

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/deploy-bria.sh <staging|production> [image-tag] [--build]"
  exit 1
fi

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

TF_PLATFORM_DIR="${REPO_ROOT}/terraform/aws/platform"
TF_APPLICATION_DIR="${REPO_ROOT}/terraform/aws/application"

get_tf_output() {
  local dir="$1"
  local key="$2"
  terraform -chdir="${dir}" output -raw "${key}" 2>/dev/null || echo ""
}

CLUSTER=$(get_tf_output "${TF_PLATFORM_DIR}" "ecs_cluster_name")
SERVICE=$(get_tf_output "${TF_APPLICATION_DIR}" "bria_service_name")
BRIA_ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM_DIR}" "ecr_bria_repository_url")

if [[ -z "${CLUSTER}" ]]; then
  CLUSTER="${ECS_CLUSTER_NAME}"
fi

if [[ -z "${SERVICE}" ]]; then
  SERVICE="${BRIA_ECS_SERVICE_NAME:-${PROJECT}-bria-service-${ENVIRONMENT}}"
fi

if [[ -z "${CLUSTER}" || -z "${SERVICE}" ]]; then
  echo "ERROR: Could not resolve Bria cluster/service"
  exit 1
fi

if [[ "${BUILD_IMAGE}" == "true" ]]; then
  if [[ -z "${BRIA_ECR_REPO_URL}" ]]; then
    echo "ERROR: Missing ecr_bria_repository_url terraform output; cannot --build"
    exit 1
  fi

  BRIA_IMAGE_URI="${BRIA_ECR_REPO_URL}:${IMAGE_TAG}"

  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${BRIA_ECR_REPO_URL%%/*}"

  docker build -f "${REPO_ROOT}/Dockerfile.bria" -t "${BRIA_IMAGE_URI}" "${REPO_ROOT}"
  docker push "${BRIA_IMAGE_URI}"

  echo "Bria image pushed: ${BRIA_IMAGE_URI}"
fi

"${SCRIPT_DIR}/render-bria-task-definition.sh" "${KOYA_ENV}" "${IMAGE_TAG}"

BRIA_TASK_DEF_PATH="${REPO_ROOT}/infra/rendered/ecs-bria-task-definition.json"
if [[ ! -f "${BRIA_TASK_DEF_PATH}" ]]; then
  echo "ERROR: Rendered Bria task definition not found at ${BRIA_TASK_DEF_PATH}"
  exit 1
fi

BRIA_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${BRIA_TASK_DEF_PATH}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

if [[ -z "${BRIA_TASK_DEF_ARN}" ]] || [[ "${BRIA_TASK_DEF_ARN}" == "None" ]]; then
  echo "ERROR: Failed to register Bria task definition"
  exit 1
fi

echo "Registered Bria task definition: ${BRIA_TASK_DEF_ARN}"

aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --task-definition "${BRIA_TASK_DEF_ARN}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --query 'service.taskDefinition' \
  --output text >/dev/null

echo "Waiting for Bria service to reach steady state..."
aws ecs wait services-stable \
  --cluster "${CLUSTER}" \
  --services "${SERVICE}" \
  --region "${AWS_REGION}"

echo "Running private-topology validation..."
"${SCRIPT_DIR}/validate-bria-private.sh" "${KOYA_ENV}" "${CLUSTER}" "${SERVICE}"

echo "Bria deploy complete: ${SERVICE} -> ${BRIA_TASK_DEF_ARN}"
