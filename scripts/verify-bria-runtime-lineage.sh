#!/usr/bin/env bash
set -euo pipefail

# verify-bria-runtime-lineage.sh — Verify deployed API task uses expected Bria lineage + network policy vars.
#
# Usage:
#   ./scripts/verify-bria-runtime-lineage.sh <staging|production>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/verify-bria-runtime-lineage.sh <staging|production>"
  exit 1
fi

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

service_json="$(aws ecs describe-services \
  --cluster "${ECS_CLUSTER_NAME}" \
  --services "${ECS_SERVICE_NAME}" \
  --region "${AWS_REGION}" \
  --query 'services[0]' \
  --output json)"

task_def_arn="$(jq -r '.taskDefinition // empty' <<< "${service_json}")"
if [[ -z "${task_def_arn}" ]]; then
  echo "ERROR: failed to resolve task definition for ${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}"
  exit 1
fi

env_json="$(aws ecs describe-task-definition \
  --task-definition "${task_def_arn}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.containerDefinitions[0].environment' \
  --output json)"

read_env_var() {
  local key="$1"
  jq -r --arg k "${key}" '.[] | select(.name == $k) | .value' <<< "${env_json}" | head -n1
}

assert_match() {
  local key="$1"
  local expected="$2"
  local actual
  actual="$(read_env_var "${key}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "ERROR: ${key} mismatch (expected='${expected}' actual='${actual}')"
    exit 1
  fi
}

assert_match "BRIA_WALLET_NAME" "${BRIA_WALLET_NAME}"
assert_match "BRIA_PAYOUT_QUEUE" "${BRIA_PAYOUT_QUEUE}"
assert_match "BRIA_PAYOUT_QUEUE_NAME" "${BRIA_PAYOUT_QUEUE_NAME}"
assert_match "BRIA_ACCOUNT_NAME" "${BRIA_ACCOUNT_NAME}"
assert_match "BRIA_SERVICE_PROFILE" "${BRIA_SERVICE_PROFILE}"
assert_match "BRIA_XPUB_REF" "${BRIA_XPUB_REF}"
assert_match "BRIA_NETWORK" "${BRIA_NETWORK}"
assert_match "BTC_NETWORK" "${BTC_NETWORK}"

echo "Bria runtime lineage verification passed."
echo "  Cluster/Service: ${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}"
echo "  Task definition: ${task_def_arn}"
echo "  BRIA_WALLET_NAME=${BRIA_WALLET_NAME}"
echo "  BRIA_PAYOUT_QUEUE=${BRIA_PAYOUT_QUEUE}"
echo "  BRIA_PAYOUT_QUEUE_NAME=${BRIA_PAYOUT_QUEUE_NAME}"
echo "  BRIA_ACCOUNT_NAME=${BRIA_ACCOUNT_NAME}"
echo "  BRIA_SERVICE_PROFILE=${BRIA_SERVICE_PROFILE}"
echo "  BRIA_XPUB_REF=${BRIA_XPUB_REF}"
echo "  BRIA_NETWORK=${BRIA_NETWORK}"
echo "  BTC_NETWORK=${BTC_NETWORK}"
