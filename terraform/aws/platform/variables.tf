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

# ── DNS ──────────────────────────────────────────────────────────

variable "domain_name" {
  type        = string
  default     = "koyabank.com"
  description = "Root domain name"
}

variable "api_subdomain" {
  type        = string
  default     = "api"
  description = "API subdomain (creates api.koyabank.com)"
}

variable "route53_zone_id" {
  type        = string
  default     = ""
  description = "Route53 hosted zone ID. If empty, DNS records are skipped."
}

# ── Secrets ──────────────────────────────────────────────────────

variable "secrets_map_path" {
  type        = string
  default     = ""
  description = "Path to secrets-map.json. If empty, creates default Koya secrets."
}
