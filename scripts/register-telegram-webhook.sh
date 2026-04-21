#!/usr/bin/env bash
set -euo pipefail

# register-telegram-webhook.sh — register and verify Telegram webhook for Koya API.
# Usage: ./scripts/register-telegram-webhook.sh <staging|production>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/register-telegram-webhook.sh <staging|production>"
  exit 1
fi

source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

if ! command -v aws >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: aws and jq are required"
  exit 1
fi

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"
BOT_PATH=$(jq -r '.secrets["TELEGRAM_BOT_TOKEN"].path' "${SECRETS_MAP}")
SECRET_PATH=$(jq -r '.secrets["TELEGRAM_WEBHOOK_SECRET"].path' "${SECRETS_MAP}")

BOT_TOKEN=$(aws secretsmanager get-secret-value --secret-id "${BOT_PATH}" --region "${AWS_REGION}" --query 'SecretString' --output text)
WEBHOOK_SECRET=$(aws secretsmanager get-secret-value --secret-id "${SECRET_PATH}" --region "${AWS_REGION}" --query 'SecretString' --output text)

WEBHOOK_URL="https://api.koyabank.com/api/v1/messaging/webhooks/telegram"

RESP=$(curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "secret_token=${WEBHOOK_SECRET}")

echo "setWebhook response:"
echo "${RESP}" | jq .

INFO=$(curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")

echo "getWebhookInfo response:"
echo "${INFO}" | jq .

ACTUAL_URL=$(echo "${INFO}" | jq -r '.result.url // empty')
if [[ "${ACTUAL_URL}" != "${WEBHOOK_URL}" ]]; then
  echo "ERROR: Telegram webhook URL mismatch. expected=${WEBHOOK_URL} actual=${ACTUAL_URL}"
  exit 1
fi

echo "Telegram webhook registration verified."
