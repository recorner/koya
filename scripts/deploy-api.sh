#!/usr/bin/env bash
set -euo pipefail

# deploy-api.sh — Build, push, migrate, and deploy the Koya API.
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
#   4. Runs the migration task
#   5. Waits for migration to complete
#   6. Updates the ECS service (force new deployment)
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

# ── Run database migrations ──────────────────────────────────────

if [[ "${SKIP_MIGRATE}" != "true" ]]; then
  echo ""
  echo "=== Step 1: Run database migrations ==="

  TASK_ARN=$(aws ecs run-task \
    --cluster "${CLUSTER}" \
    --task-definition "${MIGRATE_TASK_FAMILY}" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=ENABLED}" \
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
    echo "Check CloudWatch logs for: ${MIGRATE_TASK_FAMILY}"
    exit 1
  fi

  echo "Migrations completed successfully."
fi

# ── Update ECS service ───────────────────────────────────────────

echo ""
echo "=== Step 2: Update API service ==="

aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --query 'service.deployments[0].status' \
  --output text

echo ""
echo "API service update triggered."
echo ""
echo "Monitor with:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --region ${AWS_REGION}"
echo ""

# ── Health check ─────────────────────────────────────────────────

if [[ -n "${API_SUBDOMAIN:-}" ]] && [[ -n "${DOMAIN_NAME:-}" ]]; then
  HEALTH_URL="https://${API_SUBDOMAIN}.${DOMAIN_NAME}/api/v1/health"
  echo "=== Step 3: Verify health ==="
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
