# ── Core ─────────────────────────────────────────────────────────

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "environment" {
  type        = string
  description = "Environment name (staging, production)"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "project" {
  type        = string
  default     = "koya"
  description = "Project name prefix"
}

variable "tf_state_bucket" {
  type        = string
  description = "S3 bucket for Terraform remote state"
}

# ── Container ────────────────────────────────────────────────────

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Docker image tag to deploy"
}

variable "api_cpu" {
  type        = number
  default     = 512
  description = "API task CPU units"
}

variable "api_memory" {
  type        = number
  default     = 1024
  description = "API task memory (MB)"
}

variable "migrate_cpu" {
  type        = number
  default     = 256
  description = "Migrate task CPU units"
}

variable "migrate_memory" {
  type        = number
  default     = 512
  description = "Migrate task memory (MB)"
}

variable "bria_image_tag" {
  type        = string
  default     = "latest"
  description = "Bria image tag to deploy"
}

variable "bria_cpu" {
  type        = number
  default     = 512
  description = "Bria task CPU units"
}

variable "bria_memory" {
  type        = number
  default     = 1024
  description = "Bria task memory (MB)"
}

variable "bria_desired_count" {
  type        = number
  default     = 1
  description = "Desired Bria task count"
}

variable "bria_port" {
  type        = number
  default     = 2742
  description = "Bria API gRPC port"
}

variable "bria_admin_port" {
  type        = number
  default     = 2743
  description = "Bria admin gRPC port"
}

# ── Service ──────────────────────────────────────────────────────

variable "desired_count" {
  type        = number
  default     = 2
  description = "Desired number of API tasks (staging=1, production=2)"
}

variable "assign_public_ip" {
  type        = bool
  default     = false
  description = "Assign public IP to tasks (true if using public subnets)"
}

# ── Application Config (non-secret, from env file) ──────────────

variable "node_env" {
  type    = string
  default = "production"
}

variable "api_port" {
  type    = number
  default = 3333
}

variable "mpesa_shortcode" {
  type    = string
  default = "174379"
}

variable "mpesa_driver" {
  type    = string
  default = "daraja"
}

variable "mpesa_environment" {
  type    = string
  default = "sandbox"
}

variable "btc_delivery_driver" {
  type    = string
  default = "dfns"
}

variable "btc_network" {
  type    = string
  default = "bitcoin"
}

variable "messaging_enable_whatsapp_cloud" {
  type    = string
  default = "true"
}

variable "messaging_enable_telegram" {
  type    = string
  default = "true"
}

variable "messaging_max_retries" {
  type    = string
  default = "4"
}

variable "messaging_retry_base_ms" {
  type    = string
  default = "1200"
}

variable "whatsapp_phone_number_id" {
  type    = string
  default = ""
}

variable "whatsapp_cloud_api_version" {
  type    = string
  default = "v21.0"
}

variable "whatsapp_web_base_url" {
  type    = string
  default = "https://koyabank.com"
}

variable "telegram_allowed_ips" {
  type    = string
  default = ""
}

variable "cors_origins" {
  type    = string
  default = "https://koyabank.com,https://www.koyabank.com"
}

variable "redis_host" {
  type    = string
  default = "redis.koyabank.com"
}

variable "redis_port" {
  type    = string
  default = "6379"
}

variable "redis_tls" {
  type    = string
  default = "false"
}

variable "redis_db" {
  type    = string
  default = "0"
}

variable "bria_api_host" {
  type    = string
  default = "db.koyabank.com"
}

variable "bria_api_port" {
  type    = string
  default = "2742"
}

variable "bria_network" {
  type    = string
  default = "testnet4"
}

variable "bria_electrum_url" {
  type    = string
  default = "mempool.space:40002"
}

variable "dfns_api_url" {
  type    = string
  default = "https://api.dfns.ninja/v2"
}

variable "dfns_app_id" {
  type    = string
  default = ""
}

variable "dfns_service_account" {
  type    = string
  default = ""
}

variable "dfns_wallet_id" {
  type    = string
  default = ""
}

variable "mpesa_callback_url" {
  type    = string
  default = ""
}

variable "dfns_webhook_url" {
  type    = string
  default = ""
}

variable "bria_wallet_name" {
  type    = string
  default = "koya-testnet"
}

variable "bria_payout_queue_name" {
  type    = string
  default = "koya-payouts"
}

variable "bria_xpub_ref" {
  type    = string
  default = "koya-testnet-xpub"
}

variable "bria_private_dns_namespace" {
  type    = string
  default = "koya.internal"
}

variable "bria_private_dns_name" {
  type    = string
  default = "koya-bria"
}

variable "bria_db_name" {
  type    = string
  default = "bria"
}

variable "bria_db_username" {
  type    = string
  default = "bria"
}

variable "bria_db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "bria_db_allocated_storage" {
  type    = number
  default = 20
}

variable "bria_stream_reconnect_base_ms" {
  type    = string
  default = "1000"
}

variable "bria_stream_reconnect_max_ms" {
  type    = string
  default = "30000"
}

variable "bria_stream_reconnect_jitter_ms" {
  type    = string
  default = "500"
}

variable "psbt_archive_s3_bucket" {
  type    = string
  default = ""
}

variable "trust_proxy_hops" {
  type    = string
  default = "1"
}

variable "json_body_limit" {
  type    = string
  default = "100kb"
}

variable "urlencoded_body_limit" {
  type    = string
  default = "100kb"
}

variable "throttle_default_limit" {
  type    = string
  default = "60"
}

variable "throttle_default_ttl_seconds" {
  type    = string
  default = "60"
}

variable "cloudwatch_metrics_enabled" {
  type    = string
  default = "true"
}

# ── Autoscaling ──────────────────────────────────────────────────

variable "autoscaling_min_capacity" {
  type    = number
  default = 2
}

variable "autoscaling_max_capacity" {
  type    = number
  default = 10
}

variable "autoscaling_cpu_target" {
  type    = number
  default = 60
}

variable "autoscaling_memory_target" {
  type    = number
  default = 70
}

variable "autoscaling_request_count_target" {
  type    = number
  default = 500
}

# ── WAF ──────────────────────────────────────────────────────────

variable "waf_global_rate_limit" {
  type    = number
  default = 2000
}

variable "waf_conversion_rate_limit" {
  type    = number
  default = 500
}

variable "waf_webhook_rate_limit" {
  type    = number
  default = 1000
}

# ── Alarms ───────────────────────────────────────────────────────

variable "alarm_429_threshold" {
  type    = number
  default = 50
}

variable "alarm_5xx_threshold" {
  type    = number
  default = 10
}

variable "alarm_latency_threshold_ms" {
  type    = number
  default = 5000
}

variable "alarm_request_count_threshold" {
  type    = number
  default = 10000
}

variable "alarm_waf_block_threshold" {
  type    = number
  default = 100
}

variable "ops_notification_endpoint" {
  type    = string
  default = "https://hooks.slack.com/services/PLACEHOLDER"
}

variable "oneuptime_notification_endpoint" {
  type    = string
  default = "https://oneuptime.com/api/webhook/PLACEHOLDER"
}
