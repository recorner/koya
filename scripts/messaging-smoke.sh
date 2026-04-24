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
WA_WABA_ID="${WHATSAPP_BUSINESS_ACCOUNT_ID}"
WA_API_VERSION="${WHATSAPP_CLOUD_API_VERSION}"
TG_TOKEN=$(get_secret "$(get_secret_path TELEGRAM_BOT_TOKEN)")

if [[ "${WHATSAPP_PREFLIGHT}" == "true" ]]; then
  if [[ -z "${WA_WABA_ID}" ]]; then
    echo "ERROR: WHATSAPP_BUSINESS_ACCOUNT_ID is not set."
    exit 1
  fi

  PREFLIGHT_RESP=$(curl -sS -X GET \
    "https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating,account_mode" \
    -H "Authorization: Bearer ${WA_TOKEN}" \
    -H "Content-Type: application/json")
  echo "WhatsApp phone-id preflight response:"
  echo "${PREFLIGHT_RESP}" | jq .

  if echo "${PREFLIGHT_RESP}" | jq -e '.error' >/dev/null 2>&1; then
    echo "ERROR: Phone-id preflight failed. Token may be invalid/expired or missing permissions."
    exit 1
  fi

  WABA_RESP=$(curl -sS -X GET \
    "https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/phone_numbers?fields=id,display_phone_number,verified_name&limit=200" \
    -H "Authorization: Bearer ${WA_TOKEN}" \
    -H "Content-Type: application/json")
  echo "WhatsApp WABA preflight response:"
  echo "${WABA_RESP}" | jq .

  if echo "${WABA_RESP}" | jq -e '.error' >/dev/null 2>&1; then
    echo "ERROR: WABA preflight failed. Token may not belong to this WABA or lacks whatsapp_business_management scope."
    exit 1
  fi

  MATCH_COUNT=$(echo "${WABA_RESP}" | jq -r --arg phone_id "${WA_PHONE_ID}" '[.data[]? | select((.id|tostring) == $phone_id)] | length')
  if [[ "${MATCH_COUNT}" == "0" ]]; then
    echo "ERROR: Config mismatch. WHATSAPP_PHONE_NUMBER_ID=${WA_PHONE_ID} is not attached to WHATSAPP_BUSINESS_ACCOUNT_ID=${WA_WABA_ID}."
    exit 1
  fi

  echo "WhatsApp preflight checks passed: phone id is attached to configured WABA."
fi

if [[ "${PREFLIGHT_ONLY}" == "true" ]]; then
  echo "Preflight complete. Skipping outbound send checks (--preflight-only)."
  exit 0
fi

WA_PAYLOAD=$(jq -n --arg to "${WHATSAPP_RECIPIENT}" --arg msg "Koya check-in: your new WhatsApp sender is active and replies are working." '{messaging_product:"whatsapp",to:$to,type:"text",text:{body:$msg}}')
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
