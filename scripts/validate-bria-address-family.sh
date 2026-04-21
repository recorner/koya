#!/usr/bin/env bash
set -euo pipefail

# validate-bria-address-family.sh — Fail-fast check that Bria emits addresses
# in the intended BTC family for the current Koya network policy.
#
# Usage:
#   ./scripts/validate-bria-address-family.sh <staging|production> [wallet_name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"
WALLET_OVERRIDE="${2:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/validate-bria-address-family.sh <staging|production> [wallet_name]"
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

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"
if [[ ! -f "${SECRETS_MAP}" ]]; then
  echo "ERROR: secrets map not found at ${SECRETS_MAP}"
  exit 1
fi

secret_path() {
  local logical_name="$1"
  jq -r --arg name "${logical_name}" '.secrets[$name].path // empty' "${SECRETS_MAP}"
}

BRIA_API_KEY_PATH="$(secret_path "BRIA_API_KEY")"
if [[ -z "${BRIA_API_KEY_PATH}" ]]; then
  echo "ERROR: BRIA_API_KEY path missing in secrets map"
  exit 1
fi

BRIA_API_KEY="$(aws secretsmanager get-secret-value \
  --secret-id "${BRIA_API_KEY_PATH}" \
  --region "${AWS_REGION}" \
  --query 'SecretString' \
  --output text)"

ALB_DNS="$(aws elbv2 describe-load-balancers \
  --region "${AWS_REGION}" \
  --names "${PROJECT}-api-alb-${ENVIRONMENT}" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)"

if [[ -z "${ALB_DNS}" || "${ALB_DNS}" == "None" ]]; then
  echo "ERROR: could not resolve API ALB DNS name"
  exit 1
fi

wallet_name="${WALLET_OVERRIDE:-${BRIA_WALLET_NAME:-}}"
external_id="koya:bria:addr-validate:${ENVIRONMENT}:$(date -u +%Y%m%d%H%M%S)"

if [[ -n "${wallet_name}" ]]; then
  payload="$(jq -nc \
    --arg ext "${external_id}" \
    --arg wallet "${wallet_name}" \
    '{businessContextType:"bria_validation",businessContextRef:"address_family_probe",externalId:$ext,walletName:$wallet}')"
else
  payload="$(jq -nc \
    --arg ext "${external_id}" \
    '{businessContextType:"bria_validation",businessContextRef:"address_family_probe",externalId:$ext}')"
fi

tmp_body="$(mktemp)"
http_code="$(curl -ksS \
  -o "${tmp_body}" \
  -w "%{http_code}" \
  -X POST "https://${ALB_DNS}/api/v1/internal/btc-backend/deposit-addresses" \
  -H "content-type: application/json" \
  -H "x-admin-api-key: ${BRIA_API_KEY}" \
  -d "${payload}")"

if [[ "${http_code}" != "200" && "${http_code}" != "201" ]]; then
  echo "ERROR: deposit issuance probe failed (HTTP ${http_code})"
  cat "${tmp_body}"
  rm -f "${tmp_body}"
  exit 1
fi

address="$(jq -r '.address // empty' "${tmp_body}")"
rm -f "${tmp_body}"

if [[ -z "${address}" ]]; then
  echo "ERROR: probe response did not include an address"
  exit 1
fi

policy_network="$(echo "${BTC_NETWORK:-bitcoin}" | tr '[:upper:]' '[:lower:]')"
expected_family="unknown"
case "${policy_network}" in
  bitcoin|mainnet)
    expected_family="mainnet"
    ;;
  testnet|testnet4|signet)
    expected_family="testnet"
    ;;
  regtest)
    expected_family="regtest"
    ;;
esac

detected_family="unknown"
lower_addr="$(echo "${address}" | tr '[:upper:]' '[:lower:]')"
if [[ "${lower_addr}" == bc1* || "${lower_addr}" == 1* || "${lower_addr}" == 3* ]]; then
  detected_family="mainnet"
elif [[ "${lower_addr}" == tb1* || "${lower_addr}" == m* || "${lower_addr}" == n* || "${lower_addr}" == 2* ]]; then
  detected_family="testnet"
elif [[ "${lower_addr}" == bcrt1* ]]; then
  detected_family="regtest"
fi

if [[ "${expected_family}" != "${detected_family}" ]]; then
  echo "ERROR: Bria emitted wrong address family"
  echo "  Address: ${address}"
  echo "  Expected: ${expected_family} (BTC_NETWORK=${policy_network})"
  echo "  Detected: ${detected_family}"
  exit 1
fi

echo "Bria address-family validation passed."
echo "  Wallet: ${wallet_name:-<backend-default>}"
echo "  BTC_NETWORK: ${policy_network}"
echo "  Address: ${address}"
