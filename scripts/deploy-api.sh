#!/usr/bin/env bash
set -euo pipefail

# deploy-api.sh — Build, push, register task definitions, migrate, and deploy the Koya API.
#
# Usage:
#   ./scripts/deploy-api.sh <environment> [image-tag] [--build] [--skip-migrate] [--live-ecs]
#   ./scripts/deploy-api.sh staging latest
#   ./scripts/deploy-api.sh production v1.2.3 --build
#
# This script:
#   1. Loads environment config (no hardcoded values)
#   2. Resolves Terraform outputs for subnets, SGs, cluster, service (or discovers from live ECS)
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
IMAGE_TAG="latest"
BUILD_IMAGE=false
SKIP_MIGRATE=false
WITH_BRIA=false
BUILD_BRIA_IMAGE=false
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
    --build)
      BUILD_IMAGE=true
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    --with-bria)
      WITH_BRIA=true
      shift
      ;;
    --build-bria)
      BUILD_BRIA_IMAGE=true
      shift
      ;;
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
  echo "Usage: ./scripts/deploy-api.sh <staging|production> [image-tag] [--build] [--skip-migrate] [--with-bria] [--build-bria] [--live-ecs] [--cluster <name>] [--service <name>]"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

normalize_ecr_repo_url() {
  local image="$1"
  local repo="${image%@*}"
  if [[ "${repo}" == *:* ]]; then
    repo="${repo%:*}"
  fi
  echo "${repo}"
}

service_is_active() {
  local cluster="$1"
  local service="$2"
  local status
  status=$(aws ecs describe-services \
    --cluster "${cluster}" \
    --services "${service}" \
    --region "${AWS_REGION}" \
    --query 'services[0].status' \
    --output text 2>/dev/null || true)
  [[ "${status}" == "ACTIVE" ]]
}

discover_live_service() {
  local service_candidate="${PROJECT}-api"

  if [[ -n "${LIVE_CLUSTER}" && -n "${LIVE_SERVICE}" ]] && service_is_active "${LIVE_CLUSTER}" "${LIVE_SERVICE}"; then
    return
  fi

  if [[ -n "${LIVE_CLUSTER}" && -z "${LIVE_SERVICE}" ]] && service_is_active "${LIVE_CLUSTER}" "${service_candidate}"; then
    LIVE_SERVICE="${service_candidate}"
    return
  fi

  if [[ -n "${LIVE_SERVICE}" ]] && [[ -z "${LIVE_CLUSTER}" ]]; then
    while IFS= read -r cluster_arn; do
      local cluster_name="${cluster_arn##*/}"
      if service_is_active "${cluster_name}" "${LIVE_SERVICE}"; then
        LIVE_CLUSTER="${cluster_name}"
        return
      fi
    done < <(aws ecs list-clusters --region "${AWS_REGION}" --query 'clusterArns[]' --output text | tr '\t' '\n')
  fi

  while IFS= read -r cluster_arn; do
    local cluster_name="${cluster_arn##*/}"
    if service_is_active "${cluster_name}" "${service_candidate}"; then
      LIVE_CLUSTER="${cluster_name}"
      LIVE_SERVICE="${service_candidate}"
      return
    fi
  done < <(aws ecs list-clusters --region "${AWS_REGION}" --query 'clusterArns[]' --output text | tr '\t' '\n')

  local cluster_count
  cluster_count=$(aws ecs list-clusters --region "${AWS_REGION}" --query 'length(clusterArns)' --output text 2>/dev/null || echo "0")
  if [[ "${cluster_count}" == "1" ]]; then
    LIVE_CLUSTER=$(aws ecs list-clusters --region "${AWS_REGION}" --query 'clusterArns[0]' --output text | awk -F/ '{print $NF}')
    local service_count
    service_count=$(aws ecs list-services --cluster "${LIVE_CLUSTER}" --region "${AWS_REGION}" --query 'length(serviceArns)' --output text 2>/dev/null || echo "0")
    if [[ "${service_count}" == "1" ]]; then
      LIVE_SERVICE=$(aws ecs list-services --cluster "${LIVE_CLUSTER}" --region "${AWS_REGION}" --query 'serviceArns[0]' --output text | awk -F/ '{print $NF}')
      return
    fi
  fi

  echo "ERROR: Could not auto-discover live ECS service. Provide --cluster and --service."
  exit 1
}

resolve_from_terraform() {
  echo ""
  echo "=== Resolving infrastructure from Terraform ==="

  local tf_foundation="${REPO_ROOT}/terraform/aws/foundation"
  local tf_platform="${REPO_ROOT}/terraform/aws/platform"
  local tf_application="${REPO_ROOT}/terraform/aws/application"

  get_tf_output() {
    terraform -chdir="$1" output -raw "$2" 2>/dev/null || echo ""
  }

  local subnet_output_key="public_subnet_ids"
  if [[ "${ASSIGN_PUBLIC_IP:-true}" != "true" ]]; then
    subnet_output_key="private_subnet_ids"
  fi

  SUBNETS_JSON=$(terraform -chdir="${tf_foundation}" output -json "${subnet_output_key}" 2>/dev/null || echo '[]')
  SUBNETS=$(echo "${SUBNETS_JSON}" | jq -r 'join(",")')
  SECURITY_GROUP=$(get_tf_output "${tf_foundation}" "ecs_security_group_id")
  ECR_REPO_URL=$(get_tf_output "${tf_platform}" "ecr_repository_url")
  CLUSTER=$(get_tf_output "${tf_platform}" "ecs_cluster_name")
  SERVICE=$(get_tf_output "${tf_application}" "api_service_name")

  if [[ "${ASSIGN_PUBLIC_IP:-true}" == "true" ]]; then
    ASSIGN_PUBLIC_IP_MODE="ENABLED"
  else
    ASSIGN_PUBLIC_IP_MODE="DISABLED"
  fi

  for var_name in CLUSTER SERVICE ECR_REPO_URL SUBNETS SECURITY_GROUP; do
    if [[ -z "${!var_name}" ]] || [[ "${!var_name}" == "None" ]]; then
      return 1
    fi
  done

  return 0
}

resolve_from_live_ecs() {
  echo ""
  echo "=== Resolving infrastructure from live ECS ==="

  discover_live_service

  CLUSTER="${LIVE_CLUSTER}"
  SERVICE="${LIVE_SERVICE}"

  SUBNETS=$(aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'join(`,`, services[0].networkConfiguration.awsvpcConfiguration.subnets)' \
    --output text)

  SECURITY_GROUP=$(aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'join(`,`, services[0].networkConfiguration.awsvpcConfiguration.securityGroups)' \
    --output text)

  ASSIGN_PUBLIC_IP_MODE=$(aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' \
    --output text)

  CURRENT_TASK_DEF=$(aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' \
    --output text)

  CURRENT_IMAGE=$(aws ecs describe-task-definition \
    --task-definition "${CURRENT_TASK_DEF}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.containerDefinitions[0].image' \
    --output text)

  ECR_REPO_URL=$(normalize_ecr_repo_url "${CURRENT_IMAGE}")
  LIVE_ECS_MODE=true

  for var_name in CLUSTER SERVICE ECR_REPO_URL SUBNETS SECURITY_GROUP; do
    if [[ -z "${!var_name}" ]] || [[ "${!var_name}" == "None" ]]; then
      echo "ERROR: Missing ${var_name} in live ECS discovery."
      exit 1
    fi
  done
}
if [[ "${LIVE_ECS_MODE}" == "true" ]]; then
  resolve_from_live_ecs
else
  if ! resolve_from_terraform; then
    echo "⚠ Terraform outputs unavailable. Falling back to live ECS discovery."
    resolve_from_live_ecs
  fi
fi

IMAGE_URI="${ECR_REPO_URL}:${IMAGE_TAG}"

if [[ "${WITH_BRIA}" == "true" ]]; then
  echo ""
  echo "=== Step 0: Deploy private Bria service ==="
  BRIA_ARGS=("${KOYA_ENV}" "${IMAGE_TAG}")
  if [[ "${BUILD_BRIA_IMAGE}" == "true" ]]; then
    BRIA_ARGS+=("--build")
  fi
  "${SCRIPT_DIR}/deploy-bria.sh" "${BRIA_ARGS[@]}"
fi

echo "  Cluster:   ${CLUSTER}"
echo "  Service:   ${SERVICE}"
echo "  Image:     ${IMAGE_URI}"
echo "  Subnets:   ${SUBNETS}"
echo "  SG:        ${SECURITY_GROUP}"

if [[ "${LIVE_ECS_MODE}" == "true" ]]; then
  echo "  Mode:      live-ecs"
else
  echo "  Mode:      terraform"
fi

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

RENDER_ARGS=("${KOYA_ENV}" "${IMAGE_TAG}")
if [[ "${LIVE_ECS_MODE}" == "true" ]]; then
  RENDER_ARGS+=("--live-ecs" "--cluster" "${CLUSTER}" "--service" "${SERVICE}")
fi

"${SCRIPT_DIR}/render-task-definitions.sh" "${RENDER_ARGS[@]}"

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
echo "Waiting for ECS service to reach steady state..."
aws ecs wait services-stable \
  --cluster "${CLUSTER}" \
  --services "${SERVICE}" \
  --region "${AWS_REGION}"

RUNNING_TASK_ARNS=$(aws ecs list-tasks \
  --cluster "${CLUSTER}" \
  --service-name "${SERVICE}" \
  --desired-status RUNNING \
  --region "${AWS_REGION}" \
  --query 'taskArns' \
  --output text)

if [[ -z "${RUNNING_TASK_ARNS}" ]] || [[ "${RUNNING_TASK_ARNS}" == "None" ]]; then
  echo "ERROR: Service reached steady state with no running tasks."
  exit 1
fi

RUNNING_TASK_DEFS=$(aws ecs describe-tasks \
  --cluster "${CLUSTER}" \
  --tasks ${RUNNING_TASK_ARNS} \
  --region "${AWS_REGION}" \
  --query 'tasks[].taskDefinitionArn' \
  --output text | tr '\t' '\n' | sort -u)

echo "Running task definition(s):"
echo "${RUNNING_TASK_DEFS}" | sed 's/^/  - /'

if ! grep -Fxq "${API_TASK_DEF_ARN}" <<< "${RUNNING_TASK_DEFS}"; then
  echo "ERROR: ECS steady state does not include newly deployed task definition."
  exit 1
fi

if [[ "$(echo "${RUNNING_TASK_DEFS}" | wc -l | tr -d ' ')" != "1" ]]; then
  echo "ERROR: ECS steady state still mixes old and new task definitions."
  exit 1
fi

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
