#!/usr/bin/env bash
set -euo pipefail

# sync-secrets.sh — Create or validate Secrets Manager entries from secrets-map.json.
#
# Usage:
#   ./scripts/sync-secrets.sh <environment>
#   ./scripts/sync-secrets.sh staging
#   ./scripts/sync-secrets.sh staging --set MPESA_CONSUMER_KEY   # set from local env
#
# Prerequisites:
#   - AWS CLI configured
#   - Environment loaded (or will auto-load)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KOYA_ENV="${1:-}"
ACTION="${2:-}"
SECRET_NAME="${3:-}"

if [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/sync-secrets.sh <staging|production> [--set SECRET_NAME]"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

SECRETS_MAP="${REPO_ROOT}/infra/secrets-map.json"

if [[ ! -f "${SECRETS_MAP}" ]]; then
  echo "ERROR: Secrets map not found: ${SECRETS_MAP}"
  exit 1
fi

# Requires jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: apt-get install jq"
  exit 1
fi

# ── List secrets from map ────────────────────────────────────────

SECRET_PATHS=$(jq -r '.secrets | to_entries[] | .value.path' "${SECRETS_MAP}")
SECRET_NAMES=$(jq -r '.secrets | keys[]' "${SECRETS_MAP}")

# ── Set a specific secret ────────────────────────────────────────

if [[ "${ACTION}" == "--set" ]]; then
  if [[ -z "${SECRET_NAME}" ]]; then
    echo "Usage: ./scripts/sync-secrets.sh <env> --set <SECRET_NAME>"
    exit 1
  fi

  SECRET_PATH=$(jq -r --arg name "${SECRET_NAME}" '.secrets[$name].path // empty' "${SECRETS_MAP}")
  if [[ -z "${SECRET_PATH}" ]]; then
    echo "ERROR: Secret '${SECRET_NAME}' not found in secrets map."
    exit 1
  fi

  # Read value from environment variable (never prompt to avoid leaking)
  SECRET_VALUE="${!SECRET_NAME:-}"
  if [[ -z "${SECRET_VALUE}" ]]; then
    echo "ERROR: Environment variable ${SECRET_NAME} is not set."
    echo "Export it first: export ${SECRET_NAME}='your-value'"
    exit 1
  fi

  echo "Setting secret: ${SECRET_PATH}"
  aws secretsmanager put-secret-value \
    --secret-id "${SECRET_PATH}" \
    --secret-string "${SECRET_VALUE}" \
    --region "${AWS_REGION}" \
    --output text >/dev/null

  echo "Secret updated: ${SECRET_PATH}"
  exit 0
fi

# ── Sync all secrets (create missing) ────────────────────────────

echo ""
echo "=== Syncing Secrets Manager entries for ${KOYA_ENV} ==="
echo ""

CREATED=0
EXISTS=0
ERRORS=0

while IFS= read -r path; do
  # Check if secret exists
  if aws secretsmanager describe-secret \
    --secret-id "${path}" \
    --region "${AWS_REGION}" \
    --output text &>/dev/null 2>&1; then
    echo "  ✓ ${path} (exists)"
    EXISTS=$((EXISTS + 1))
  else
    # Create with placeholder
    DESCRIPTION=$(jq -r --arg path "${path}" \
      '.secrets | to_entries[] | select(.value.path == $path) | .value.description' \
      "${SECRETS_MAP}")

    echo "  + Creating: ${path}"
    if aws secretsmanager create-secret \
      --name "${path}" \
      --description "${DESCRIPTION}" \
      --secret-string "PLACEHOLDER_REPLACE_ME" \
      --region "${AWS_REGION}" \
      --output text >/dev/null 2>&1; then
      CREATED=$((CREATED + 1))
    else
      echo "    ERROR: Failed to create ${path}"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done <<< "${SECRET_PATHS}"

echo ""
echo "=== Summary ==="
echo "  Existing: ${EXISTS}"
echo "  Created:  ${CREATED}"
echo "  Errors:   ${ERRORS}"
echo ""

# ── Validate required secrets have real values ───────────────────

echo "=== Checking for placeholder values ==="
PLACEHOLDERS=0

REQUIRED_PATHS=$(jq -r '.secrets | to_entries[] | select(.value.required == true) | .value.path' "${SECRETS_MAP}")

while IFS= read -r path; do
  VALUE=$(aws secretsmanager get-secret-value \
    --secret-id "${path}" \
    --region "${AWS_REGION}" \
    --query 'SecretString' \
    --output text 2>/dev/null || echo "")

  if [[ "${VALUE}" == "PLACEHOLDER_REPLACE_ME" ]] || [[ -z "${VALUE}" ]]; then
    echo "  ⚠ ${path} — still has placeholder value"
    PLACEHOLDERS=$((PLACEHOLDERS + 1))
  else
    echo "  ✓ ${path} — has real value"
  fi
done <<< "${REQUIRED_PATHS}"

if [[ ${PLACEHOLDERS} -gt 0 ]]; then
  echo ""
  echo "WARNING: ${PLACEHOLDERS} required secret(s) still have placeholder values."
  echo "Set them with: ./scripts/sync-secrets.sh ${KOYA_ENV} --set <SECRET_NAME>"
fi
