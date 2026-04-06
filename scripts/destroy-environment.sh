#!/usr/bin/env bash
set -euo pipefail

# destroy-environment.sh — Ordered teardown of Koya AWS infrastructure.
#
# Usage:
#   ./scripts/destroy-environment.sh <layer> <environment>
#   ./scripts/destroy-environment.sh application staging
#   ./scripts/destroy-environment.sh platform staging
#   ./scripts/destroy-environment.sh foundation staging
#   ./scripts/destroy-environment.sh all staging          # Full teardown (with confirmation)
#
# Layers are destroyed in reverse order: application → platform → foundation
#
# SAFETY:
#   - Production requires explicit --confirm-production flag
#   - Each layer prompts for confirmation
#   - Foundation teardown warns about VPC dependencies

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LAYER="${1:-}"
KOYA_ENV="${2:-}"
CONFIRM_PRODUCTION=false
AUTO_APPROVE=false

shift 2 2>/dev/null || true
for arg in "$@"; do
  case "${arg}" in
    --confirm-production) CONFIRM_PRODUCTION=true ;;
    --auto) AUTO_APPROVE=true ;;
    *) echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

if [[ -z "${LAYER}" ]] || [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/destroy-environment.sh <application|platform|foundation|all> <staging|production>"
  exit 1
fi

# Safety check for production
if [[ "${KOYA_ENV}" == "production" ]] && [[ "${CONFIRM_PRODUCTION}" != "true" ]]; then
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  DANGER: You are about to destroy PRODUCTION resources  ║"
  echo "║  Add --confirm-production flag to proceed               ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

TF_DIR="${REPO_ROOT}/terraform/aws"
STATE_BUCKET="${TF_STATE_BUCKET}"
STATE_REGION="${AWS_REGION}"

# ── Helper: Destroy a single layer ───────────────────────────────

destroy_layer() {
  local layer_name="$1"
  local layer_dir="${TF_DIR}/${layer_name}"

  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  DESTROYING: ${layer_name} (${KOYA_ENV})"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  if [[ ! -d "${layer_dir}" ]]; then
    echo "Layer directory not found: ${layer_dir}. Skipping."
    return 0
  fi

  # Ensure terraform is initialized
  terraform -chdir="${layer_dir}" init \
    -backend-config="bucket=${STATE_BUCKET}" \
    -backend-config="region=${STATE_REGION}" \
    -backend-config="dynamodb_table=koya-terraform-locks" \
    -reconfigure 2>/dev/null || true

  if [[ "${AUTO_APPROVE}" == "true" ]]; then
    terraform -chdir="${layer_dir}" destroy \
      -var="environment=${KOYA_ENV}" \
      -var="aws_region=${AWS_REGION}" \
      -var="project=${PROJECT}" \
      -auto-approve
  else
    terraform -chdir="${layer_dir}" destroy \
      -var="environment=${KOYA_ENV}" \
      -var="aws_region=${AWS_REGION}" \
      -var="project=${PROJECT}"
  fi

  echo "Layer ${layer_name} destroyed."
}

# ── Main ─────────────────────────────────────────────────────────

case "${LAYER}" in
  application)
    destroy_layer "application"
    ;;
  platform)
    echo "WARNING: Destroying platform will remove ECR, ECS cluster, ALB, and secrets."
    echo "Make sure the application layer is destroyed first."
    echo ""
    destroy_layer "platform"
    ;;
  foundation)
    echo "WARNING: Destroying foundation will remove VPC, subnets, security groups, and IAM roles."
    echo "Make sure platform and application layers are destroyed first."
    echo ""
    destroy_layer "foundation"
    ;;
  all)
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  FULL TEARDOWN: ${KOYA_ENV}"
    echo "║  Order: application → platform → foundation"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""

    if [[ "${AUTO_APPROVE}" != "true" ]]; then
      read -rp "Are you sure? Type 'destroy ${KOYA_ENV}' to confirm: " confirmation
      if [[ "${confirmation}" != "destroy ${KOYA_ENV}" ]]; then
        echo "Aborted."
        exit 1
      fi
    fi

    destroy_layer "application"
    destroy_layer "platform"
    destroy_layer "foundation"

    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  Full teardown complete for: ${KOYA_ENV}"
    echo "║  Note: S3 state bucket and DynamoDB lock table remain."
    echo "╚══════════════════════════════════════════════════════════╝"
    ;;
  *)
    echo "ERROR: Unknown layer: ${LAYER}"
    echo "Valid layers: application, platform, foundation, all"
    exit 1
    ;;
esac
