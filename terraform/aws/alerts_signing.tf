# CloudWatch alarm for PSBT sign-pending latency
# Fires when any PSBT is stuck in signing_pending for > 10 minutes

resource "aws_cloudwatch_metric_alarm" "sign_pending_stuck" {
  alarm_name          = "koya-sign-pending-stuck-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SignPendingCount"
  namespace           = "Koya/Signing"
  period              = 600 # 10 minutes
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "PSBTs stuck in signing_pending > 10 minutes — possible DFNS issue or circuit breaker trip"
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Service     = "koya"
    Component   = "psbt-signing"
    Severity    = "critical"
    Environment = var.environment
  }
}
