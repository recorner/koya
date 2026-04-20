# AWS WAF — API ingress protection
#
# Attaches a WAF Web ACL to the API ALB with:
# 1. AWS managed common rule set (OWASP protections)
# 2. Known bad inputs rule set
# 3. IP reputation list
# 4. Global rate-based rule (2000 req/5min per IP)
# 5. Stricter rate-based rule for guest-conversion endpoints (500 req/5min)
# 6. Stricter rate-based rule for webhook endpoints (1000 req/5min)
#
# Usage:
#   cd terraform/aws
#   terraform init
#   terraform apply -var="alb_arn=arn:aws:elasticloadbalancing:..."
#
# Environment differences:
#   - Staging: lower rate limits for testing (use -var="environment=staging")
#   - Production: defaults apply

variable "alb_arn" {
  type        = string
  description = "ARN of the API Application Load Balancer"
}

variable "waf_global_rate_limit" {
  type        = number
  default     = 2000
  description = "Global rate limit: requests per 5-minute window per IP"
}

variable "waf_conversion_rate_limit" {
  type        = number
  default     = 500
  description = "Rate limit for /api/v1/guest-conversion/* per 5-minute window per IP"
}

variable "waf_webhook_rate_limit" {
  type        = number
  default     = 1000
  description = "Rate limit for webhook endpoints per 5-minute window per IP"
}

# ── Web ACL ──────────────────────────────────────────────────────

resource "aws_wafv2_web_acl" "api" {
  name        = "koya-api-waf-${var.environment}"
  description = "WAF for Koya API ALB"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: AWS Managed Common Rule Set (OWASP core protections)
  rule {
    name     = "aws-common-rules"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: Known Bad Inputs (SQL injection, XSS, etc.)
  rule {
    name     = "aws-known-bad-inputs"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: IP Reputation List (known malicious IPs)
  rule {
    name     = "aws-ip-reputation"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Global rate-based rule (all endpoints)
  rule {
    name     = "global-rate-limit"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_global_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-global-rate"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Stricter rate limit for guest-conversion endpoints
  rule {
    name     = "conversion-rate-limit"
    priority = 20

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_conversion_rate_limit
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/v1/guest-conversion/"
            positional_constraint = "STARTS_WITH"

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-conversion-rate"
      sampled_requests_enabled   = true
    }
  }

  # Rule 6: Rate limit for webhook/callback endpoints
  rule {
    name     = "webhook-rate-limit"
    priority = 30

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_webhook_rate_limit
        aggregate_key_type = "IP"

        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "/api/v1/payments/mpesa/callback"
                positional_constraint = "STARTS_WITH"

                field_to_match {
                  uri_path {}
                }

                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }

            statement {
              byte_match_statement {
                search_string         = "/api/v1/dfns/webhook"
                positional_constraint = "STARTS_WITH"

                field_to_match {
                  uri_path {}
                }

                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }

            statement {
              byte_match_statement {
                search_string         = "/api/v1/messaging/webhooks/whatsapp-cloud"
                positional_constraint = "STARTS_WITH"

                field_to_match {
                  uri_path {}
                }

                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "/api/v1/messaging/webhooks/telegram"
                positional_constraint = "STARTS_WITH"

                field_to_match {
                  uri_path {}
                }

                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "koya-waf-webhook-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "koya-api-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Service     = "koya"
    Component   = "waf"
    Environment = var.environment
  }
}

# ── WAF ↔ ALB Association ────────────────────────────────────────

resource "aws_wafv2_web_acl_association" "api_alb" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}

# ── WAF Logging (optional — to CloudWatch) ──────────────────────

resource "aws_wafv2_web_acl_logging_configuration" "api" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn            = aws_wafv2_web_acl.api.arn
}

resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-koya-api-${var.environment}"
  retention_in_days = 30

  tags = {
    Service     = "koya"
    Component   = "waf-logs"
    Environment = var.environment
  }
}
