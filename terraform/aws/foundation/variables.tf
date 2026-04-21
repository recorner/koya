# ── Core ─────────────────────────────────────────────────────────

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for all resources"
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
  description = "Project name prefix for all resources"
}

# ── VPC ──────────────────────────────────────────────────────────

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for the VPC"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
  description = "AZs for subnets (minimum 2)"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
  description = "CIDR blocks for public subnets (one per AZ)"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
  description = "CIDR blocks for private subnets (one per AZ)"
}

# ── External access ──────────────────────────────────────────────

variable "db_cidr_blocks" {
  type        = list(string)
  default     = ["34.62.75.187/32"]
  description = "CIDR blocks for external database access (e.g. GCP cassini)"
}

variable "redis_cidr_blocks" {
  type        = list(string)
  default     = ["34.62.75.187/32"]
  description = "CIDR blocks for external Redis access"
}

# ── Logs ─────────────────────────────────────────────────────────

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "CloudWatch log group retention in days"
}

# ── IAM / OIDC ───────────────────────────────────────────────────

variable "github_oidc_provider_arn" {
  type        = string
  default     = ""
  description = "Existing GitHub OIDC provider ARN to reuse (optional)"
}
