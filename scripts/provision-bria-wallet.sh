#!/usr/bin/env bash
set -euo pipefail

# provision-bria-wallet.sh — Idempotent Bria wallet bootstrap + secret rotation helper.
#
# This script is intended to run from an environment that can resolve and reach
# the private Bria endpoint (e.g., bastion host, SSM shell, or private runner).
#
# Usage:
#   ./scripts/provision-bria-wallet.sh <staging|production>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/provision-bria-wallet.sh <staging|production>"
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

put_secret() {
  local path="$1"
  local value="$2"
  local tmp
  tmp=$(mktemp)
  chmod 600 "${tmp}"
  printf '%s' "${value}" > "${tmp}"

  aws secretsmanager put-secret-value \
    --secret-id "${path}" \
    --secret-string "file://${tmp}" \
    --region "${AWS_REGION}" \
    --output text >/dev/null

  rm -f "${tmp}"
}

BRIA_API_KEY_PATH=$(secret_path "BRIA_API_KEY")
BRIA_ADMIN_API_KEY_PATH=$(secret_path "BRIA_ADMIN_API_KEY")
BRIA_DESC_EXTERNAL_PATH=$(secret_path "BRIA_WALLET_DESCRIPTOR_EXTERNAL")
BRIA_DESC_INTERNAL_PATH=$(secret_path "BRIA_WALLET_DESCRIPTOR_INTERNAL")

if [[ -z "${BRIA_API_KEY_PATH}" || -z "${BRIA_ADMIN_API_KEY_PATH}" || -z "${BRIA_DESC_EXTERNAL_PATH}" || -z "${BRIA_DESC_INTERNAL_PATH}" ]]; then
  echo "ERROR: Missing required Bria secret path mapping in infra/secrets-map.json"
  exit 1
fi

export BRIA_API_KEY="$(get_secret "${BRIA_API_KEY_PATH}" 2>/dev/null || true)"
export BRIA_ADMIN_API_KEY="$(get_secret "${BRIA_ADMIN_API_KEY_PATH}" 2>/dev/null || true)"
export BRIA_WALLET_DESCRIPTOR_EXTERNAL="$(get_secret "${BRIA_DESC_EXTERNAL_PATH}")"
export BRIA_WALLET_DESCRIPTOR_INTERNAL="$(get_secret "${BRIA_DESC_INTERNAL_PATH}")"

PROVISION_OUTPUT=$(node "${REPO_ROOT}/apps/api/scripts/provision-bria-wallet.mjs")

PROFILE_API_KEY=$(jq -r '.profileApiKey // empty' <<< "${PROVISION_OUTPUT}")
GENERATED_ADMIN_API_KEY=$(jq -r '.generatedAdminApiKey // empty' <<< "${PROVISION_OUTPUT}")
WALLET_NAME=$(jq -r '.walletName // empty' <<< "${PROVISION_OUTPUT}")
PAYOUT_QUEUE_NAME=$(jq -r '.payoutQueueName // empty' <<< "${PROVISION_OUTPUT}")
VERIFICATION_ADDRESS=$(jq -r '.verificationAddress // empty' <<< "${PROVISION_OUTPUT}")

if [[ -z "${PROFILE_API_KEY}" ]]; then
  echo "ERROR: Provisioning output did not include a profile API key"
  exit 1
fi

put_secret "${BRIA_API_KEY_PATH}" "${PROFILE_API_KEY}"
if [[ -n "${GENERATED_ADMIN_API_KEY}" ]]; then
  put_secret "${BRIA_ADMIN_API_KEY_PATH}" "${GENERATED_ADMIN_API_KEY}"
fi

unset BRIA_API_KEY BRIA_ADMIN_API_KEY BRIA_WALLET_DESCRIPTOR_EXTERNAL BRIA_WALLET_DESCRIPTOR_INTERNAL PROFILE_API_KEY GENERATED_ADMIN_API_KEY

echo "Bria wallet provisioning complete."
echo "  Wallet: ${WALLET_NAME}"
echo "  Payout queue: ${PAYOUT_QUEUE_NAME}"
echo "  Verification address: ${VERIFICATION_ADDRESS}"
echo "  Updated Secrets Manager paths:"
echo "    - ${BRIA_API_KEY_PATH}"
if [[ -n "${GENERATED_ADMIN_API_KEY}" ]]; then
  echo "    - ${BRIA_ADMIN_API_KEY_PATH}"
fi
