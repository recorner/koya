# CloudWatch alarms + SNS topic for reconciliation monitoring
# Fires when Koya ↔ Bria ledger discrepancy is detected

variable "ops_notification_endpoint" {
  type        = string
  description = "HTTPS endpoint for ops alerts (Slack webhook)"
  default     = "https://hooks.slack.com/services/PLACEHOLDER"
}

variable "oneuptime_notification_endpoint" {
  type        = string
  description = "HTTPS endpoint for OneUptime alerts"
  default     = "https://oneuptime.com/api/webhook/PLACEHOLDER"
}

# --- SNS Topic ---

resource "aws_sns_topic" "reconciliation_alerts" {
  name = "koya-reconciliation-alerts-${var.environment}"

  tags = {
    Service     = "koya"
    Component   = "reconciliation"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "ops_webhook" {
  topic_arn = aws_sns_topic.reconciliation_alerts.arn
  protocol  = "https"
  endpoint  = var.ops_notification_endpoint
}

resource "aws_sns_topic_subscription" "oneuptime_webhook" {
  topic_arn = aws_sns_topic.reconciliation_alerts.arn
  protocol  = "https"
  endpoint  = var.oneuptime_notification_endpoint
}

# --- CloudWatch Alarms ---

# WARNING: any non-zero delta
resource "aws_cloudwatch_metric_alarm" "reconciliation_delta_nonzero" {
  alarm_name          = "koya-reconciliation-absdelta-nonzero-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AbsDelta"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "WARNING: Reconciliation absolute delta is > 0 sats"
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Service     = "koya"
    Component   = "reconciliation"
    Severity    = "warning"
    Environment = var.environment
  }
}

# CRITICAL: delta > 1000 sats — escalate immediately
resource "aws_cloudwatch_metric_alarm" "reconciliation_delta_critical" {
  alarm_name          = "koya-reconciliation-absdelta-critical-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AbsDelta"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 1000
  alarm_description   = "CRITICAL: Reconciliation absolute delta > 1000 sats — escalate to @recorner"
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Service     = "koya"
    Component   = "reconciliation"
    Severity    = "critical"
    Environment = var.environment
  }
}

# Mismatch count alarm
resource "aws_cloudwatch_metric_alarm" "reconciliation_mismatch_count" {
  alarm_name          = "koya-reconciliation-mismatch-count-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "MismatchCount"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Reconciliation found mismatched payouts"
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Service     = "koya"
    Component   = "reconciliation"
    Severity    = "warning"
    Environment = var.environment
  }
}
