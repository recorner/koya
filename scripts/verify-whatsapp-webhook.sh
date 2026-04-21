#!/usr/bin/env bash
set -euo pipefail

# verify-whatsapp-webhook.sh — verify WhatsApp challenge endpoint with current verify token.
# Usage: ./scripts/verify-whatsapp-webhook.sh <staging|production>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/verify-whatsapp-webhook.sh <staging|production>"
  exit 1
fi

source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

if ! command -v aws >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: aws and jq are required"
  exit 1
fi

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"
VERIFY_PATH=$(jq -r '.secrets["WHATSAPP_VERIFY_TOKEN"].path' "${SECRETS_MAP}")
VERIFY_TOKEN=$(aws secretsmanager get-secret-value --secret-id "${VERIFY_PATH}" --region "${AWS_REGION}" --query 'SecretString' --output text)

CHALLENGE="koya-verify-$(date +%s)"
URL="https://api.koyabank.com/api/v1/messaging/webhooks/whatsapp-cloud?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}"

RESP=$(curl -sS -w "\n%{http_code}" "${URL}")
BODY=$(echo "${RESP}" | head -n1)
CODE=$(echo "${RESP}" | tail -n1)

if [[ "${CODE}" != "200" || "${BODY}" != "${CHALLENGE}" ]]; then
  echo "ERROR: WhatsApp webhook challenge failed (code=${CODE}, body=${BODY})"
  exit 1
fi

echo "WhatsApp webhook challenge verified."
