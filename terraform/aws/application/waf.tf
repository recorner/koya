# AWS WAF — API ingress protection
#
# Rules:
# 1. AWS managed common rule set (OWASP protections)
# 2. Known bad inputs rule set
# 3. IP reputation list
# 4. Global rate-based rule
# 5. Stricter rate for guest-conversion endpoints
# 6. Stricter rate for webhook endpoints

resource "aws_wafv2_web_acl" "api" {
  name        = "${var.project}-api-waf-${var.environment}"
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
      metric_name                = "${var.project}-waf-common-rules"
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
      metric_name                = "${var.project}-waf-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: IP Reputation List
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
      metric_name                = "${var.project}-waf-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Global rate-based rule
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
      metric_name                = "${var.project}-waf-global-rate"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Stricter rate for guest-conversion endpoints
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
      metric_name                = "${var.project}-waf-conversion-rate"
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
      metric_name                = "${var.project}-waf-webhook-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Component = "waf"
  }
}

# ── WAF ↔ ALB Association ────────────────────────────────────────

resource "aws_wafv2_web_acl_association" "api_alb" {
  resource_arn = local.platform.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}

# ── WAF Logging ──────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${var.project}-api-${var.environment}"
  retention_in_days = 30

  tags = {
    Component = "waf-logs"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "api" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn            = aws_wafv2_web_acl.api.arn
}
