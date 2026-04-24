#!/usr/bin/env bash
set -euo pipefail

# inspect-bria-lineage.sh — Non-mutating Bria lineage inspection and one-address probe.
#
# Usage:
#   ./scripts/inspect-bria-lineage.sh <staging|production|integration>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/inspect-bria-lineage.sh <staging|production|integration>"
  exit 1
fi

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}" >/dev/null

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required"
  exit 1
fi

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"
if [[ ! -f "${SECRETS_MAP}" ]]; then
  echo "ERROR: secrets map not found at ${SECRETS_MAP}"
  exit 1
fi

secret_path() {
  local logical_name="$1"
  jq -r --arg name "${logical_name}" '.secrets[$name].path // empty' "${SECRETS_MAP}"
}

get_secret() {
  local path="$1"
  aws secretsmanager get-secret-value \
    --secret-id "${path}" \
    --region "${AWS_REGION}" \
    --query 'SecretString' \
    --output text
}

BRIA_API_KEY_PATH=$(secret_path "BRIA_API_KEY")
BRIA_ADMIN_API_KEY_PATH=$(secret_path "BRIA_ADMIN_API_KEY")

if [[ -z "${BRIA_API_KEY_PATH}" ]]; then
  echo "ERROR: BRIA_API_KEY path missing in secrets map"
  exit 1
fi

export BRIA_API_KEY="$(get_secret "${BRIA_API_KEY_PATH}")"
export BRIA_ADMIN_API_KEY="$(get_secret "${BRIA_ADMIN_API_KEY_PATH}" 2>/dev/null || true)"

node "${REPO_ROOT}/apps/api/scripts/inspect-bria-lineage.mjs" | jq .
