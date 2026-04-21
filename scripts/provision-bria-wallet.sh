#!/usr/bin/env bash
set -euo pipefail

# provision-bria-wallet.sh — Idempotent Bria wallet bootstrap + secret rotation helper.
#
# This script is intended to run from an environment that can resolve and reach
# the private Bria endpoint (e.g., bastion host, SSM shell, or private runner).
#
# Usage:
#   ./scripts/provision-bria-wallet.sh <staging|production>
#   ./scripts/provision-bria-wallet.sh <staging|production> --fresh-lineage [--lineage-tag <tag>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"
shift || true
FRESH_LINEAGE="false"
LINEAGE_TAG=""

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/provision-bria-wallet.sh <staging|production> [--fresh-lineage] [--lineage-tag <tag>]"
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh-lineage)
      FRESH_LINEAGE="true"
      shift
      ;;
    --lineage-tag)
      LINEAGE_TAG="${2:-}"
      if [[ -z "${LINEAGE_TAG}" ]]; then
        echo "ERROR: --lineage-tag requires a value"
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "ERROR: Unknown option: $1"
      echo "Usage: ./scripts/provision-bria-wallet.sh <staging|production> [--fresh-lineage] [--lineage-tag <tag>]"
      exit 1
      ;;
  esac
done

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

SECRETS_OUTPUT_FILE="$(mktemp)"
chmod 600 "${SECRETS_OUTPUT_FILE}"
trap 'rm -f "${SECRETS_OUTPUT_FILE}"' EXIT

export BRIA_PROVISION_SECRETS_FILE="${SECRETS_OUTPUT_FILE}"
if [[ "${FRESH_LINEAGE}" == "true" ]]; then
  export BRIA_PROVISION_FRESH_LINEAGE="true"
  if [[ -n "${LINEAGE_TAG}" ]]; then
    export BRIA_PROVISION_LINEAGE_TAG="${LINEAGE_TAG}"
  fi
fi

PROVISION_OUTPUT="$(node "${REPO_ROOT}/apps/api/scripts/provision-bria-wallet.mjs")"

PROFILE_API_KEY="$(jq -r '.profileApiKey // empty' "${SECRETS_OUTPUT_FILE}")"
GENERATED_ADMIN_API_KEY="$(jq -r '.generatedAdminApiKey // empty' "${SECRETS_OUTPUT_FILE}")"
ACCOUNT_NAME="$(jq -r '.accountName // empty' <<< "${PROVISION_OUTPUT}")"
SERVICE_PROFILE_NAME="$(jq -r '.serviceProfileName // empty' <<< "${PROVISION_OUTPUT}")"
WALLET_NAME=$(jq -r '.walletName // empty' <<< "${PROVISION_OUTPUT}")
PAYOUT_QUEUE_NAME=$(jq -r '.payoutQueueName // empty' <<< "${PROVISION_OUTPUT}")
VERIFICATION_ADDRESS=$(jq -r '.verificationAddress // empty' <<< "${PROVISION_OUTPUT}")
RESOLVED_LINEAGE_TAG="$(jq -r '.lineageTag // empty' <<< "${PROVISION_OUTPUT}")"

if [[ -z "${PROFILE_API_KEY}" ]]; then
  echo "ERROR: Provisioning output did not include a profile API key in secure output"
  exit 1
fi

put_secret "${BRIA_API_KEY_PATH}" "${PROFILE_API_KEY}"
if [[ -n "${GENERATED_ADMIN_API_KEY}" ]]; then
  put_secret "${BRIA_ADMIN_API_KEY_PATH}" "${GENERATED_ADMIN_API_KEY}"
fi

unset BRIA_API_KEY BRIA_ADMIN_API_KEY BRIA_WALLET_DESCRIPTOR_EXTERNAL BRIA_WALLET_DESCRIPTOR_INTERNAL PROFILE_API_KEY GENERATED_ADMIN_API_KEY BRIA_PROVISION_SECRETS_FILE BRIA_PROVISION_FRESH_LINEAGE BRIA_PROVISION_LINEAGE_TAG

echo "Bria wallet provisioning complete."
echo "  Account: ${ACCOUNT_NAME}"
echo "  Service profile: ${SERVICE_PROFILE_NAME}"
echo "  Wallet: ${WALLET_NAME}"
echo "  Payout queue: ${PAYOUT_QUEUE_NAME}"
echo "  Verification address: ${VERIFICATION_ADDRESS}"
if [[ -n "${RESOLVED_LINEAGE_TAG}" ]]; then
  echo "  Lineage tag: ${RESOLVED_LINEAGE_TAG}"
fi
echo "  Updated Secrets Manager paths:"
echo "    - ${BRIA_API_KEY_PATH}"
if [[ -n "${GENERATED_ADMIN_API_KEY}" ]]; then
  echo "    - ${BRIA_ADMIN_API_KEY_PATH}"
fi
