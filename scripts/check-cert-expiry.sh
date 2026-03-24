#!/usr/bin/env bash
# scripts/check-cert-expiry.sh
# Check DFNS mTLS certificate expiry from AWS Secrets Manager.
# Exits non-zero if certificate expires within WARN_DAYS.
#
# Usage:
#   ./scripts/check-cert-expiry.sh [--secret-id /koya/dfns/mTLS/cert] [--region us-east-1] [--warn-days 14]
#
# Can be used as:
#   - Pre-deploy check in CI
#   - Cron job on the runner
#   - Part of nightly workflow

set -euo pipefail

SECRET_ID="/koya/dfns/mTLS/cert"
REGION="us-east-1"
WARN_DAYS=14

while [[ $# -gt 0 ]]; do
  case $1 in
    --secret-id) SECRET_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --warn-days) WARN_DAYS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "Checking certificate expiry: $SECRET_ID"

# Fetch cert from Secrets Manager
CERT=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null)

if [[ -z "$CERT" ]]; then
  echo "ERROR: Could not fetch certificate from Secrets Manager"
  exit 2
fi

# Parse expiry date
EXPIRY_STR=$(echo "$CERT" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [[ -z "$EXPIRY_STR" ]]; then
  echo "ERROR: Could not parse certificate expiry date"
  exit 2
fi

EXPIRY_EPOCH=$(date -d "$EXPIRY_STR" +%s 2>/dev/null || date -jf "%b %d %H:%M:%S %Y %Z" "$EXPIRY_STR" +%s 2>/dev/null)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

echo "Certificate expires: $EXPIRY_STR"
echo "Days remaining: $DAYS_LEFT"

if [[ $DAYS_LEFT -lt 0 ]]; then
  echo "CRITICAL: Certificate has EXPIRED"
  exit 1
elif [[ $DAYS_LEFT -lt $WARN_DAYS ]]; then
  echo "WARNING: Certificate expires in $DAYS_LEFT days (threshold: $WARN_DAYS)"
  echo "ACTION: Run scripts/rotate-dfns-mtls.sh to rotate certificates"
  exit 1
else
  echo "OK: Certificate valid for $DAYS_LEFT more days"
  exit 0
fi
