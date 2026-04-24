#!/usr/bin/env bash
set -euo pipefail

# reprovision-bria-lineage.sh — Deterministic Bria lineage reset and validation workflow.
#
# Usage:
#   ./scripts/reprovision-bria-lineage.sh <production|staging> [--lineage-tag <tag>] [--no-write-env] [--deploy]
#
# Notes:
# - Non-funding workflow. Do not fund wallets until address-family validation passes.
# - By default this updates env/<environment>.env with the new lineage references.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KOYA_ENV="${1:-}"
shift || true

LINEAGE_TAG=""
WRITE_ENV=true
DEPLOY=false

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/reprovision-bria-lineage.sh <production|staging> [--lineage-tag <tag>] [--no-write-env] [--deploy]"
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lineage-tag)
      LINEAGE_TAG="${2:-}"
      if [[ -z "${LINEAGE_TAG}" ]]; then
        echo "ERROR: --lineage-tag requires a value"
        exit 1
      fi
      shift 2
      ;;
    --no-write-env)
      WRITE_ENV=false
      shift
      ;;
    --deploy)
      DEPLOY=true
      shift
      ;;
    *)
      echo "ERROR: Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "${LINEAGE_TAG}" ]]; then
  LINEAGE_TAG="$(date -u +%Y%m%d%H%M%S)"
fi

sanitize_lineage_tag() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9' | cut -c1-14
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  if rg -q "^${key}=" "${file}"; then
    awk -v k="${key}" -v v="${value}" '
      BEGIN { updated = 0 }
      $0 ~ ("^" k "=") { print k "=" v; updated = 1; next }
      { print }
      END { if (!updated) print k "=" v }
    ' "${file}" > "${tmp}"
  else
    cat "${file}" > "${tmp}"
    printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
  fi

  mv "${tmp}" "${file}"
}

# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

LINEAGE_SUFFIX="-$(sanitize_lineage_tag "${LINEAGE_TAG}")"
if [[ "${LINEAGE_SUFFIX}" == "-" ]]; then
  echo "ERROR: lineage tag '${LINEAGE_TAG}' sanitized to empty value"
  exit 1
fi

CURRENT_QUEUE_BASE="${BRIA_PAYOUT_QUEUE_NAME:-${BRIA_PAYOUT_QUEUE:-koya-payouts}}"
NEW_WALLET_NAME="${BRIA_WALLET_NAME}${LINEAGE_SUFFIX}"
NEW_QUEUE_NAME="${CURRENT_QUEUE_BASE}${LINEAGE_SUFFIX}"
NEW_XPUB_REF="${BRIA_XPUB_REF}${LINEAGE_SUFFIX}"
CURRENT_ACCOUNT_BASE="${BRIA_ACCOUNT_NAME:-koya}"
CURRENT_PROFILE_BASE="${BRIA_SERVICE_PROFILE:-koya-service}"
NEW_ACCOUNT_NAME="${CURRENT_ACCOUNT_BASE}${LINEAGE_SUFFIX}"
NEW_SERVICE_PROFILE="${CURRENT_PROFILE_BASE}${LINEAGE_SUFFIX}"

echo "=== Step 1: Inspect current lineage (${KOYA_ENV}) ==="
"${SCRIPT_DIR}/inspect-bria-lineage.sh" "${KOYA_ENV}"

echo ""
echo "=== Step 2: Provision fresh lineage (${LINEAGE_TAG}) ==="
"${SCRIPT_DIR}/provision-bria-wallet.sh" "${KOYA_ENV}" --fresh-lineage --lineage-tag "${LINEAGE_TAG}"

if [[ "${WRITE_ENV}" == "true" ]]; then
  ENV_FILE="${REPO_ROOT}/env/${KOYA_ENV}.env"
  echo ""
  echo "=== Step 3: Persist lineage identifiers to ${ENV_FILE} ==="
  upsert_env_var "${ENV_FILE}" "BRIA_WALLET_NAME" "${NEW_WALLET_NAME}"
  upsert_env_var "${ENV_FILE}" "BRIA_PAYOUT_QUEUE" "${NEW_QUEUE_NAME}"
  upsert_env_var "${ENV_FILE}" "BRIA_PAYOUT_QUEUE_NAME" "${NEW_QUEUE_NAME}"
  upsert_env_var "${ENV_FILE}" "BRIA_XPUB_REF" "${NEW_XPUB_REF}"
  upsert_env_var "${ENV_FILE}" "BRIA_ACCOUNT_NAME" "${NEW_ACCOUNT_NAME}"
  upsert_env_var "${ENV_FILE}" "BRIA_SERVICE_PROFILE" "${NEW_SERVICE_PROFILE}"
  echo "Persisted:"
  echo "  BRIA_ACCOUNT_NAME=${NEW_ACCOUNT_NAME}"
  echo "  BRIA_SERVICE_PROFILE=${NEW_SERVICE_PROFILE}"
  echo "  BRIA_WALLET_NAME=${NEW_WALLET_NAME}"
  echo "  BRIA_PAYOUT_QUEUE_NAME=${NEW_QUEUE_NAME}"
  echo "  BRIA_XPUB_REF=${NEW_XPUB_REF}"
else
  echo ""
  echo "=== Step 3: Skipped env file persistence (--no-write-env) ==="
fi

echo ""
echo "=== Step 4: Validate emitted address family for new wallet ==="
if ! "${SCRIPT_DIR}/validate-bria-address-family.sh" "${KOYA_ENV}" "${NEW_WALLET_NAME}"; then
  echo ""
  echo "FATAL: Fresh-lineage provisioning still emits an incompatible address family."
  echo "Escalation required: re-bootstrap Bria on a fresh tenant/database, then rerun this script."
  echo "Recommended sequence:"
  echo "  1) create fresh Bria DB and update /koya/bria/pgConnection"
  echo "  2) redeploy Bria service: ./scripts/deploy-bria.sh ${KOYA_ENV} latest"
  echo "  3) rerun: ./scripts/reprovision-bria-lineage.sh ${KOYA_ENV} --lineage-tag ${LINEAGE_TAG}"
  exit 1
fi

if [[ "${DEPLOY}" == "true" ]]; then
  echo ""
  echo "=== Step 5: Redeploy API + Bria with persisted lineage references ==="
  "${SCRIPT_DIR}/deploy-api.sh" "${KOYA_ENV}" latest --with-bria
fi

echo ""
echo "=== Reprovision complete ==="
echo "Address-family validation passed for wallet: ${NEW_WALLET_NAME}"
echo "No funding should occur until full production deploy smoke checks also pass."
