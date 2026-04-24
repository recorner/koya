#!/usr/bin/env bash
set -euo pipefail

# bootstrap-aws.sh — Layer-by-layer Terraform provisioning for Koya.
#
# Usage:
#   ./scripts/bootstrap-aws.sh <layer> <environment>
#   ./scripts/bootstrap-aws.sh init staging          # Initialize remote state backend
#   ./scripts/bootstrap-aws.sh foundation staging     # VPC, subnets, SGs, IAM, logs
#   ./scripts/bootstrap-aws.sh platform staging       # ECR, ECS cluster, ALB, secrets
#   ./scripts/bootstrap-aws.sh application staging    # Task defs, service, WAF, alarms
#   ./scripts/bootstrap-aws.sh all staging            # All layers in order
#
# Options:
#   --plan    Show plan only, don't apply
#   --auto    Auto-approve (no confirmation prompt)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LAYER="${1:-}"
KOYA_ENV="${2:-}"
PLAN_ONLY=false
AUTO_APPROVE=false

# Parse additional flags
shift 2 || true
for arg in "$@"; do
  case "${arg}" in
    --plan) PLAN_ONLY=true ;;
    --auto) AUTO_APPROVE=true ;;
    *) echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

if [[ -z "${LAYER}" ]] || [[ -z "${KOYA_ENV}" ]]; then
  echo "Usage: ./scripts/bootstrap-aws.sh <init|foundation|platform|application|all> <staging|production>"
  exit 1
fi

# Load environment
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh" "${KOYA_ENV}"

TF_DIR="${REPO_ROOT}/terraform/aws"
STATE_BUCKET="${TF_STATE_BUCKET}"
STATE_REGION="${AWS_REGION}"

# ── Helper: Terraform init + apply for a layer ──────────────────

apply_layer() {
  local layer_name="$1"
  local layer_dir="${TF_DIR}/${layer_name}"

  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  Layer: ${layer_name} | Environment: ${KOYA_ENV}"
  echo "════════════════════════════════════════════════════════"
  echo ""

  if [[ ! -d "${layer_dir}" ]]; then
    echo "ERROR: Layer directory not found: ${layer_dir}"
    exit 1
  fi

  # Init with backend config
  echo "=== terraform init ==="
  terraform -chdir="${layer_dir}" init \
    -backend-config="bucket=${STATE_BUCKET}" \
    -backend-config="region=${STATE_REGION}" \
    -backend-config="dynamodb_table=koya-terraform-locks" \
    -reconfigure

  # Build tfvars from environment
  local tfvars_file="${layer_dir}/${KOYA_ENV}.auto.tfvars"
  generate_tfvars "${layer_name}" "${tfvars_file}"

  if [[ "${PLAN_ONLY}" == "true" ]]; then
    echo ""
    echo "=== terraform plan ==="
    terraform -chdir="${layer_dir}" plan
  else
    echo ""
    echo "=== terraform apply ==="
    if [[ "${AUTO_APPROVE}" == "true" ]]; then
      terraform -chdir="${layer_dir}" apply -auto-approve
    else
      terraform -chdir="${layer_dir}" apply
    fi
  fi

  # Clean up generated tfvars
  rm -f "${tfvars_file}"
}

# ── Generate tfvars from environment ─────────────────────────────

generate_tfvars() {
  local layer_name="$1"
  local output_file="$2"

  cat > "${output_file}" <<EOF
# Auto-generated from env/${KOYA_ENV}.env — do not edit
aws_region  = "${AWS_REGION}"
environment = "${ENVIRONMENT}"
project     = "${PROJECT}"
EOF

  case "${layer_name}" in
    foundation)
      # Foundation needs VPC/subnet config (use defaults from variables.tf)
      local github_oidc_arn=""
      local oidc_arns
      oidc_arns="$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text 2>/dev/null || true)"
      for arn in ${oidc_arns}; do
        if [[ -z "${arn}" ]]; then
          continue
        fi
        local provider_url
        provider_url="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${arn}" --query 'Url' --output text 2>/dev/null || true)"
        if [[ "${provider_url}" == "token.actions.githubusercontent.com" ]]; then
          github_oidc_arn="${arn}"
          break
        fi
      done
      if [[ -n "${github_oidc_arn}" ]]; then
        cat >> "${output_file}" <<EOF
github_oidc_provider_arn = "${github_oidc_arn}"
EOF
      fi
      ;;
    platform)
      cat >> "${output_file}" <<EOF
tf_state_bucket = "${TF_STATE_BUCKET}"
domain_name     = "${DOMAIN_NAME}"
api_subdomain   = "${API_SUBDOMAIN}"
route53_zone_id = "${ROUTE53_ZONE_ID}"
EOF
      ;;
    application)
      cat >> "${output_file}" <<EOF
tf_state_bucket              = "${TF_STATE_BUCKET}"
image_tag                    = "${IMAGE_TAG:-latest}"
bria_image_tag               = "${BRIA_IMAGE_TAG:-latest}"
api_cpu                      = ${API_CPU}
api_memory                   = ${API_MEMORY}
migrate_cpu                  = ${MIGRATE_CPU}
migrate_memory               = ${MIGRATE_MEMORY}
desired_count                = ${DESIRED_COUNT}
assign_public_ip             = ${ASSIGN_PUBLIC_IP}
node_env                     = "${NODE_ENV}"
api_port                     = ${PORT}
mpesa_shortcode              = "${MPESA_SHORTCODE}"
mpesa_driver                 = "${MPESA_DRIVER}"
mpesa_environment            = "${MPESA_ENVIRONMENT}"
btc_delivery_driver          = "${BTC_DELIVERY_DRIVER}"
btc_network                  = "${BTC_NETWORK}"
btc_production_network_mode  = "${BTC_PRODUCTION_NETWORK_MODE}"
btc_payout_retry_max_attempts = "${BTC_PAYOUT_RETRY_MAX_ATTEMPTS}"
btc_payout_retry_poll_ms     = "${BTC_PAYOUT_RETRY_POLL_MS}"
messaging_enable_whatsapp_cloud = "${MESSAGING_ENABLE_WHATSAPP_CLOUD}"
messaging_enable_telegram    = "${MESSAGING_ENABLE_TELEGRAM}"
messaging_max_retries        = "${MESSAGING_MAX_RETRIES}"
messaging_retry_base_ms      = "${MESSAGING_RETRY_BASE_MS}"
whatsapp_phone_number_id     = "${WHATSAPP_PHONE_NUMBER_ID}"
whatsapp_business_account_id = "${WHATSAPP_BUSINESS_ACCOUNT_ID}"
whatsapp_cloud_api_version   = "${WHATSAPP_CLOUD_API_VERSION}"
whatsapp_web_base_url        = "${WHATSAPP_WEB_BASE_URL}"
telegram_allowed_ips         = "${TELEGRAM_ALLOWED_IPS}"
cors_origins                 = "${CORS_ORIGINS}"
redis_host                   = "${REDIS_HOST}"
redis_port                   = "${REDIS_PORT}"
redis_tls                    = "${REDIS_TLS}"
redis_db                     = "${REDIS_DB}"
bria_api_host                = "${BRIA_API_HOST}"
bria_api_port                = "${BRIA_API_PORT}"
bria_network                 = "${BRIA_NETWORK}"
bria_electrum_url            = "${BRIA_ELECTRUM_URL}"
dfns_api_url                 = "${DFNS_API_URL}"
dfns_app_id                  = "${DFNS_APP_ID}"
dfns_service_account         = "${DFNS_SERVICE_ACCOUNT}"
dfns_wallet_id               = "${DFNS_WALLET_ID}"
mpesa_callback_url           = "${MPESA_CALLBACK_URL}"
dfns_webhook_url             = "${DFNS_WEBHOOK_URL}"
bria_wallet_name             = "${BRIA_WALLET_NAME}"
bria_account_name            = "${BRIA_ACCOUNT_NAME}"
bria_service_profile         = "${BRIA_SERVICE_PROFILE}"
bria_payout_queue_name       = "${BRIA_PAYOUT_QUEUE_NAME}"
bria_xpub_ref                = "${BRIA_XPUB_REF}"
bria_setup_enabled           = "${BRIA_SETUP_ENABLED}"
bria_stream_reconnect_base_ms = "${BRIA_STREAM_RECONNECT_BASE_MS}"
bria_stream_reconnect_max_ms = "${BRIA_STREAM_RECONNECT_MAX_MS}"
bria_stream_reconnect_jitter_ms = "${BRIA_STREAM_RECONNECT_JITTER_MS}"
psbt_archive_s3_bucket       = "${PSBT_ARCHIVE_S3_BUCKET}"
trust_proxy_hops             = "${TRUST_PROXY_HOPS}"
json_body_limit              = "${JSON_BODY_LIMIT}"
urlencoded_body_limit        = "${URLENCODED_BODY_LIMIT}"
throttle_default_limit       = "${THROTTLE_DEFAULT_LIMIT}"
throttle_default_ttl_seconds = "${THROTTLE_DEFAULT_TTL_SECONDS}"
cloudwatch_metrics_enabled   = "${CLOUDWATCH_METRICS_ENABLED}"
autoscaling_min_capacity     = ${AUTOSCALING_MIN_CAPACITY}
autoscaling_max_capacity     = ${AUTOSCALING_MAX_CAPACITY}
autoscaling_cpu_target       = ${AUTOSCALING_CPU_TARGET}
autoscaling_memory_target    = ${AUTOSCALING_MEMORY_TARGET}
waf_global_rate_limit        = ${WAF_GLOBAL_RATE_LIMIT}
waf_conversion_rate_limit    = ${WAF_CONVERSION_RATE_LIMIT}
waf_webhook_rate_limit       = ${WAF_WEBHOOK_RATE_LIMIT}
alarm_429_threshold          = ${ALARM_429_THRESHOLD}
alarm_5xx_threshold          = ${ALARM_5XX_THRESHOLD}
alarm_latency_threshold_ms   = ${ALARM_LATENCY_THRESHOLD_MS}
alarm_request_count_threshold = ${ALARM_REQUEST_COUNT_THRESHOLD}
alarm_waf_block_threshold    = ${ALARM_WAF_BLOCK_THRESHOLD}
ops_notification_endpoint    = "${OPS_NOTIFICATION_ENDPOINT}"
oneuptime_notification_endpoint = "${ONEUPTIME_NOTIFICATION_ENDPOINT}"
EOF
      ;;
  esac

  echo "Generated tfvars: ${output_file}"
}

# ── Init: Create S3 backend + DynamoDB lock table ────────────────

init_backend() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  Initializing Terraform backend for: ${KOYA_ENV}"
  echo "════════════════════════════════════════════════════════"
  echo ""

  # Create S3 bucket for state (idempotent)
  if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
    echo "S3 bucket exists: ${STATE_BUCKET}"
  else
    echo "Creating S3 bucket: ${STATE_BUCKET}"
    aws s3api create-bucket \
      --bucket "${STATE_BUCKET}" \
      --region "${STATE_REGION}"

    aws s3api put-bucket-versioning \
      --bucket "${STATE_BUCKET}" \
      --versioning-configuration Status=Enabled

    aws s3api put-bucket-encryption \
      --bucket "${STATE_BUCKET}" \
      --server-side-encryption-configuration '{
        "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
      }'

    aws s3api put-public-access-block \
      --bucket "${STATE_BUCKET}" \
      --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  fi

  # Create DynamoDB table for state locking (idempotent)
  if aws dynamodb describe-table --table-name "koya-terraform-locks" --region "${STATE_REGION}" &>/dev/null; then
    echo "DynamoDB lock table exists: koya-terraform-locks"
  else
    echo "Creating DynamoDB lock table: koya-terraform-locks"
    aws dynamodb create-table \
      --table-name "koya-terraform-locks" \
      --attribute-definitions AttributeName=LockID,AttributeType=S \
      --key-schema AttributeName=LockID,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region "${STATE_REGION}"

    aws dynamodb wait table-exists --table-name "koya-terraform-locks" --region "${STATE_REGION}"
  fi

  echo ""
  echo "Terraform backend ready:"
  echo "  State bucket: ${STATE_BUCKET}"
  echo "  Lock table:   koya-terraform-locks"
  echo "  Region:       ${STATE_REGION}"
}

# ── Main ─────────────────────────────────────────────────────────

case "${LAYER}" in
  init)
    init_backend
    ;;
  foundation)
    apply_layer "foundation"
    ;;
  platform)
    apply_layer "platform"
    ;;
  application)
    apply_layer "application"
    ;;
  all)
    init_backend
    apply_layer "foundation"
    apply_layer "platform"
    apply_layer "application"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "  All layers applied for: ${KOYA_ENV}"
    echo "════════════════════════════════════════════════════════"
    ;;
  *)
    echo "ERROR: Unknown layer: ${LAYER}"
    echo "Valid layers: init, foundation, platform, application, all"
    exit 1
    ;;
esac
