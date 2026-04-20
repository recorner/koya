#!/usr/bin/env bash
set -euo pipefail

# deploy-api.sh — Build, push, register task definitions, migrate, and deploy the Koya API.
#
# Usage:
#   ./scripts/deploy-api.sh <environment> [image-tag] [--build] [--skip-migrate]
#   ./scripts/deploy-api.sh staging latest
#   ./scripts/deploy-api.sh production v1.2.3 --build
#
# This script:
#   1. Loads environment config (no hardcoded values)
#   2. Resolves Terraform outputs for subnets, SGs, cluster, service
#   3. Optionally builds & pushes the Docker image
#   4. Renders task definitions from env + Terraform + secrets-map
#   5. Registers new migrate/API task definition revisions
#   6. Runs the migration task on the newly-registered migrate revision
#   7. Updates the ECS service to the newly-registered API revision
#
# Prerequisites:
#   - AWS CLI configured
#   - Terraform applied (foundation + platform + application)
#   - Docker (if --build flag is used)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-}"
IMAGE_TAG="${2:-latest}"
BUILD_IMAGE=false
SKIP_MIGRATE=false

# Parse flags from remaining args
shift 2 2>/dev/null || true
for arg in "$@"; do
  case "${arg}" in
    --build) BUILD_IMAGE=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    *) echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/deploy-api.sh <staging|production> [image-tag] [--build] [--skip-migrate]"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

# ── Resolve Terraform outputs ────────────────────────────────────

echo ""
echo "=== Resolving infrastructure from Terraform ==="

TF_FOUNDATION="${REPO_ROOT}/terraform/aws/foundation"
TF_PLATFORM="${REPO_ROOT}/terraform/aws/platform"
TF_APPLICATION="${REPO_ROOT}/terraform/aws/application"

get_tf_output() {
  terraform -chdir="$1" output -raw "$2" 2>/dev/null || echo ""
}

# Foundation
SUBNETS_JSON=$(terraform -chdir="${TF_FOUNDATION}" output -json public_subnet_ids 2>/dev/null || echo '[]')
SUBNETS=$(echo "${SUBNETS_JSON}" | jq -r 'join(",")')
SECURITY_GROUP=$(get_tf_output "${TF_FOUNDATION}" "ecs_security_group_id")

# Platform
ECR_REPO_URL=$(get_tf_output "${TF_PLATFORM}" "ecr_repository_url")
CLUSTER=$(get_tf_output "${TF_PLATFORM}" "ecs_cluster_name")

# Application
SERVICE=$(get_tf_output "${TF_APPLICATION}" "api_service_name")

IMAGE_URI="${ECR_REPO_URL}:${IMAGE_TAG}"
ASSIGN_PUBLIC_IP_MODE="ENABLED"
if [[ "${ASSIGN_PUBLIC_IP:-true}" != "true" ]]; then
  ASSIGN_PUBLIC_IP_MODE="DISABLED"
fi

echo "  Cluster:   ${CLUSTER}"
echo "  Service:   ${SERVICE}"
echo "  Image:     ${IMAGE_URI}"
echo "  Subnets:   ${SUBNETS}"
echo "  SG:        ${SECURITY_GROUP}"

# Validate required values
for var_name in CLUSTER SERVICE ECR_REPO_URL SUBNETS SECURITY_GROUP; do
  if [[ -z "${!var_name}" ]]; then
    echo "ERROR: Could not resolve ${var_name} from Terraform. Have you applied all layers?"
    exit 1
  fi
done

# ── Optionally build & push image ────────────────────────────────

if [[ "${BUILD_IMAGE}" == "true" ]]; then
  echo ""
  echo "=== Step 0: Build and push Docker image ==="

  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_REPO_URL%%/*}"

  docker build -f "${REPO_ROOT}/apps/api/Dockerfile" \
    -t "${IMAGE_URI}" \
    "${REPO_ROOT}"

  docker push "${IMAGE_URI}"
  echo "Image pushed: ${IMAGE_URI}"
fi

# ── Render + register task definitions ──────────────────────────

echo ""
echo "=== Step 1: Render and register task definitions ==="

"${SCRIPT_DIR}/render-task-definitions.sh" "${KOYA_ENV}" "${IMAGE_TAG}"

RENDERED_DIR="${REPO_ROOT}/infra/rendered"
API_TASK_DEF_PATH="${RENDERED_DIR}/ecs-task-definition.json"
MIGRATE_TASK_DEF_PATH="${RENDERED_DIR}/ecs-migrate-task-definition.json"

if [[ ! -f "${API_TASK_DEF_PATH}" ]] || [[ ! -f "${MIGRATE_TASK_DEF_PATH}" ]]; then
  echo "ERROR: Rendered task definitions not found under ${RENDERED_DIR}"
  exit 1
fi

MIGRATE_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${MIGRATE_TASK_DEF_PATH}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

API_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${API_TASK_DEF_PATH}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

for var_name in MIGRATE_TASK_DEF_ARN API_TASK_DEF_ARN; do
  if [[ -z "${!var_name}" ]] || [[ "${!var_name}" == "None" ]]; then
    echo "ERROR: Failed to register task definition (${var_name})"
    exit 1
  fi
done

echo "Registered migrate task definition: ${MIGRATE_TASK_DEF_ARN}"
echo "Registered API task definition:     ${API_TASK_DEF_ARN}"

# ── Run database migrations ──────────────────────────────────────

if [[ "${SKIP_MIGRATE}" != "true" ]]; then
  echo ""
  echo "=== Step 2: Run database migrations ==="

  TASK_ARN=$(aws ecs run-task \
    --cluster "${CLUSTER}" \
    --task-definition "${MIGRATE_TASK_DEF_ARN}" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=${ASSIGN_PUBLIC_IP_MODE}}" \
    --region "${AWS_REGION}" \
    --query 'tasks[0].taskArn' \
    --output text)

  echo "Migration task started: ${TASK_ARN}"
  echo "Waiting for migration to complete..."

  aws ecs wait tasks-stopped \
    --cluster "${CLUSTER}" \
    --tasks "${TASK_ARN}" \
    --region "${AWS_REGION}"

  EXIT_CODE=$(aws ecs describe-tasks \
    --cluster "${CLUSTER}" \
    --tasks "${TASK_ARN}" \
    --region "${AWS_REGION}" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)

  if [[ "${EXIT_CODE}" != "0" ]]; then
    echo "ERROR: Migration task failed with exit code ${EXIT_CODE}"
    echo "Check CloudWatch logs for task definition: ${MIGRATE_TASK_DEF_ARN}"
    exit 1
  fi

  echo "Migrations completed successfully."
fi

# ── Update ECS service ───────────────────────────────────────────

echo ""
echo "=== Step 3: Update API service ==="

aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --task-definition "${API_TASK_DEF_ARN}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --query 'service.taskDefinition' \
  --output text

echo ""
echo "API service update triggered."
echo "Service pinned to task definition: ${API_TASK_DEF_ARN}"
echo ""
echo "Monitor with:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --region ${AWS_REGION}"
echo ""

# ── Health check ─────────────────────────────────────────────────

if [[ -n "${API_SUBDOMAIN:-}" ]] && [[ -n "${DOMAIN_NAME:-}" ]]; then
  HEALTH_URL="https://${API_SUBDOMAIN}.${DOMAIN_NAME}/api/v1/health"
  echo "=== Step 4: Verify health ==="
  echo "Waiting 30 seconds for new tasks to register..."

  sleep 30

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")

  if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "✓ Health check passed: ${HEALTH_URL} → ${HTTP_CODE}"
  else
    echo "⚠ Health check returned ${HTTP_CODE}. Service may still be rolling out."
    echo "  Retry: curl -s ${HEALTH_URL}"
  fi
fi

echo ""
echo "=== Deploy complete ==="
