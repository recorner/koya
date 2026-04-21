#!/usr/bin/env bash
set -euo pipefail

# messaging-smoke.sh — outbound smoke for WhatsApp and Telegram provider APIs.
# Usage:
#   ./scripts/messaging-smoke.sh <staging|production> --whatsapp-recipient <E164> --telegram-chat-id <chat-id>
#   ./scripts/messaging-smoke.sh <staging|production> --whatsapp-preflight [--preflight-only]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"
shift || true

WHATSAPP_RECIPIENT=""
TELEGRAM_CHAT_ID=""
WHATSAPP_PREFLIGHT=false
PREFLIGHT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --whatsapp-recipient)
      WHATSAPP_RECIPIENT="$2"
      shift 2
      ;;
    --telegram-chat-id)
      TELEGRAM_CHAT_ID="$2"
      shift 2
      ;;
    --whatsapp-preflight)
      WHATSAPP_PREFLIGHT=true
      shift
      ;;
    --preflight-only)
      PREFLIGHT_ONLY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/messaging-smoke.sh <staging|production> --whatsapp-recipient <E164> --telegram-chat-id <chat-id>"
  echo "   or: ./scripts/messaging-smoke.sh <staging|production> --whatsapp-preflight [--preflight-only]"
  exit 1
fi

if [[ "${PREFLIGHT_ONLY}" == "true" && "${WHATSAPP_PREFLIGHT}" != "true" ]]; then
  echo "ERROR: --preflight-only requires --whatsapp-preflight"
  exit 1
fi

if [[ "${PREFLIGHT_ONLY}" != "true" && ( -z "${WHATSAPP_RECIPIENT}" || -z "${TELEGRAM_CHAT_ID}" ) ]]; then
  echo "Usage: ./scripts/messaging-smoke.sh <staging|production> --whatsapp-recipient <E164> --telegram-chat-id <chat-id>"
  echo "   or: ./scripts/messaging-smoke.sh <staging|production> --whatsapp-preflight [--preflight-only]"
  exit 1
fi

source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

if ! command -v aws >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: aws and jq are required"
  exit 1
fi

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"
get_secret_path() { jq -r --arg key "$1" '.secrets[$key].path' "${SECRETS_MAP}"; }
get_secret() { aws secretsmanager get-secret-value --secret-id "$1" --region "${AWS_REGION}" --query 'SecretString' --output text; }

WA_TOKEN=$(get_secret "$(get_secret_path WHATSAPP_ACCESS_TOKEN)")
WA_PHONE_ID="${WHATSAPP_PHONE_NUMBER_ID}"
WA_API_VERSION="${WHATSAPP_CLOUD_API_VERSION}"
TG_TOKEN=$(get_secret "$(get_secret_path TELEGRAM_BOT_TOKEN)")

if [[ "${WHATSAPP_PREFLIGHT}" == "true" ]]; then
  PREFLIGHT_RESP=$(curl -sS -X GET \
    "https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}?fields=id,display_phone_number,verified_name" \
    -H "Authorization: Bearer ${WA_TOKEN}" \
    -H "Content-Type: application/json")
  echo "WhatsApp preflight response:"
  echo "${PREFLIGHT_RESP}" | jq .
fi

if [[ "${PREFLIGHT_ONLY}" == "true" ]]; then
  echo "Preflight complete. Skipping outbound send checks (--preflight-only)."
  exit 0
fi

WA_PAYLOAD=$(jq -n --arg to "${WHATSAPP_RECIPIENT}" '{messaging_product:"whatsapp",to:$to,type:"text",text:{body:"Koya WhatsApp smoke test"}}')
WA_RESP=$(curl -sS -X POST "https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages" \
  -H "Authorization: Bearer ${WA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${WA_PAYLOAD}")

echo "WhatsApp send response:"
echo "${WA_RESP}" | jq .

TG_RESP=$(curl -sS -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg chat "${TELEGRAM_CHAT_ID}" '{chat_id:$chat,text:"Koya Telegram smoke test"}')")

echo "Telegram send response:"
echo "${TG_RESP}" | jq .
