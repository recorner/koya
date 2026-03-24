#!/usr/bin/env bash
# scripts/rotate-dfns-mtls.sh
# Rotate DFNS mTLS certificates in AWS Secrets Manager and trigger ECS redeploy.
#
# Usage:
#   ./scripts/rotate-dfns-mtls.sh \
#     --cert-file /path/to/new-cert.pem \
#     --key-file /path/to/new-key.pem \
#     [--ca-file /path/to/ca.pem] \
#     [--secret-prefix /koya/dfns/mTLS] \
#     [--region us-east-1] \
#     [--ecs-cluster koya-production] \
#     [--ecs-service koya-api]

set -euo pipefail

CERT_FILE=""
KEY_FILE=""
CA_FILE=""
SECRET_PREFIX="/koya/dfns/mTLS"
REGION="us-east-1"
ECS_CLUSTER=""
ECS_SERVICE=""

usage() {
  echo "Usage: $0 --cert-file <path> --key-file <path> [--ca-file <path>] [--secret-prefix <prefix>] [--region <region>] [--ecs-cluster <cluster>] [--ecs-service <service>]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --cert-file) CERT_FILE="$2"; shift 2 ;;
    --key-file) KEY_FILE="$2"; shift 2 ;;
    --ca-file) CA_FILE="$2"; shift 2 ;;
    --secret-prefix) SECRET_PREFIX="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --ecs-cluster) ECS_CLUSTER="$2"; shift 2 ;;
    --ecs-service) ECS_SERVICE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$CERT_FILE" || -z "$KEY_FILE" ]]; then
  echo "ERROR: --cert-file and --key-file are required"
  usage
fi

if [[ ! -f "$CERT_FILE" ]]; then echo "ERROR: cert file not found: $CERT_FILE"; exit 1; fi
if [[ ! -f "$KEY_FILE" ]]; then echo "ERROR: key file not found: $KEY_FILE"; exit 1; fi

# Validate cert/key pair match
CERT_MOD=$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5)
KEY_MOD=$(openssl rsa -noout -modulus -in "$KEY_FILE" 2>/dev/null | openssl md5)
if [[ "$CERT_MOD" != "$KEY_MOD" ]]; then
  echo "ERROR: Certificate and key do not match"
  echo "  cert modulus: $CERT_MOD"
  echo "  key modulus:  $KEY_MOD"
  exit 1
fi

# Check new cert expiry
EXPIRY=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
echo "New certificate expires: $EXPIRY"

echo ""
echo "=== Uploading certificates to Secrets Manager ==="

# Upload cert
echo "[1/3] Uploading cert → ${SECRET_PREFIX}/cert"
aws secretsmanager put-secret-value \
  --secret-id "${SECRET_PREFIX}/cert" \
  --secret-string "file://${CERT_FILE}" \
  --region "$REGION"

# Upload key
echo "[2/3] Uploading key → ${SECRET_PREFIX}/key"
aws secretsmanager put-secret-value \
  --secret-id "${SECRET_PREFIX}/key" \
  --secret-string "file://${KEY_FILE}" \
  --region "$REGION"

# Upload CA if provided
if [[ -n "$CA_FILE" && -f "$CA_FILE" ]]; then
  echo "[3/3] Uploading CA → ${SECRET_PREFIX}/ca"
  aws secretsmanager put-secret-value \
    --secret-id "${SECRET_PREFIX}/ca" \
    --secret-string "file://${CA_FILE}" \
    --region "$REGION"
else
  echo "[3/3] Skipping CA (not provided)"
fi

echo ""
echo "=== Secrets updated ==="

# Trigger ECS redeploy if cluster/service specified
if [[ -n "$ECS_CLUSTER" && -n "$ECS_SERVICE" ]]; then
  echo ""
  echo "=== Triggering ECS service redeploy ==="
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment \
    --region "$REGION"
  echo "ECS service $ECS_SERVICE in cluster $ECS_CLUSTER is redeploying"
  echo "Monitor: aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --query 'services[0].deployments'"
fi

echo ""
echo "=== Rotation complete ==="
echo ""
echo "Next steps:"
echo "  1. Register the new certificate with DFNS (dashboard or API)"
echo "  2. Verify: GET /internal/health/dfns returns status=ok"
echo "  3. Remove old certificate from DFNS after 24h grace period"
