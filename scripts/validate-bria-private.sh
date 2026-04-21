#!/usr/bin/env bash
set -euo pipefail

# validate-bria-private.sh — assert Bria ECS service is private-only.
# Usage: ./scripts/validate-bria-private.sh <environment> [cluster] [service]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

KOYA_ENV="${1:-}"
CLUSTER_OVERRIDE="${2:-}"
SERVICE_OVERRIDE="${3:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/validate-bria-private.sh <staging|production> [cluster] [service]"
  exit 1
fi

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

CLUSTER="${CLUSTER_OVERRIDE:-${ECS_CLUSTER_NAME}}"
SERVICE="${SERVICE_OVERRIDE:-${BRIA_ECS_SERVICE_NAME:-${PROJECT}-bria-service-${ENVIRONMENT}}}"

SERVICE_JSON=$(aws ecs describe-services \
  --cluster "${CLUSTER}" \
  --services "${SERVICE}" \
  --region "${AWS_REGION}" \
  --query 'services[0]' \
  --output json)

if [[ -z "${SERVICE_JSON}" || "${SERVICE_JSON}" == "null" ]]; then
  echo "ERROR: Bria service not found (${CLUSTER}/${SERVICE})"
  exit 1
fi

LB_COUNT=$(jq -r '.loadBalancers | length' <<<"${SERVICE_JSON}")
ASSIGN_PUBLIC_IP=$(jq -r '.networkConfiguration.awsvpcConfiguration.assignPublicIp // "DISABLED"' <<<"${SERVICE_JSON}")

if [[ "${LB_COUNT}" != "0" ]]; then
  echo "ERROR: Bria service has load balancers attached; must be private-only"
  exit 1
fi

if [[ "${ASSIGN_PUBLIC_IP}" != "DISABLED" ]]; then
  echo "ERROR: Bria service assignPublicIp=${ASSIGN_PUBLIC_IP}; expected DISABLED"
  exit 1
fi

SUBNETS=$(jq -r '.networkConfiguration.awsvpcConfiguration.subnets[]?' <<<"${SERVICE_JSON}")
if [[ -z "${SUBNETS}" ]]; then
  echo "ERROR: Bria service has no subnets configured"
  exit 1
fi

for subnet in ${SUBNETS}; do
  MAP_PUBLIC=$(aws ec2 describe-subnets \
    --subnet-ids "${subnet}" \
    --region "${AWS_REGION}" \
    --query 'Subnets[0].MapPublicIpOnLaunch' \
    --output text)
  if [[ "${MAP_PUBLIC}" == "True" ]]; then
    echo "ERROR: Bria service subnet ${subnet} maps public IP on launch"
    exit 1
  fi
done

echo "Bria private-service validation passed (${CLUSTER}/${SERVICE})."
