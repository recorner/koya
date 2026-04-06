# ── SNS Topics ───────────────────────────────────────────────────

resource "aws_sns_topic" "ingress_alerts" {
  name = "${var.project}-ingress-alerts-${var.environment}"
  tags = { Component = "alerts" }
}

resource "aws_sns_topic" "reconciliation_alerts" {
  name = "${var.project}-reconciliation-alerts-${var.environment}"
  tags = { Component = "alerts" }
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

# ── Ingress Alarms ───────────────────────────────────────────────

# Alarm 1: High 429 Rate
resource "aws_cloudwatch_metric_alarm" "high_429_rate" {
  alarm_name          = "${var.project}-api-high-429-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_429_threshold
  alarm_description   = "High rate of 429 responses — potential abuse"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = local.platform.alb_arn_suffix }
  alarm_actions       = [aws_sns_topic.ingress_alerts.arn]
  ok_actions          = [aws_sns_topic.ingress_alerts.arn]
  tags                = { Component = "alarm-429" }
}

# Alarm 2: High 5xx Error Rate
resource "aws_cloudwatch_metric_alarm" "high_5xx_rate" {
  alarm_name          = "${var.project}-api-high-5xx-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_5xx_threshold
  alarm_description   = "High rate of 5xx errors — app instability"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = local.platform.alb_arn_suffix }
  alarm_actions       = [aws_sns_topic.ingress_alerts.arn]
  ok_actions          = [aws_sns_topic.ingress_alerts.arn]
  tags                = { Component = "alarm-5xx" }
}

# Alarm 3: High Target Response Time
resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.project}-api-high-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_latency_threshold_ms / 1000
  alarm_description   = "Average response time exceeded ${var.alarm_latency_threshold_ms}ms"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = local.platform.alb_arn_suffix }
  alarm_actions       = [aws_sns_topic.ingress_alerts.arn]
  ok_actions          = [aws_sns_topic.ingress_alerts.arn]
  tags                = { Component = "alarm-latency" }
}

# Alarm 4: High Request Count
resource "aws_cloudwatch_metric_alarm" "high_request_count" {
  alarm_name          = "${var.project}-api-high-request-count-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_request_count_threshold
  alarm_description   = "Unusually high request volume"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = local.platform.alb_arn_suffix }
  alarm_actions       = [aws_sns_topic.ingress_alerts.arn]
  ok_actions          = [aws_sns_topic.ingress_alerts.arn]
  tags                = { Component = "alarm-request-count" }
}

# Alarm 5: Unhealthy Targets
resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "${var.project}-api-unhealthy-targets-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "One or more API tasks are unhealthy"
  treat_missing_data  = "notBreaching"
  dimensions = {
    TargetGroup  = local.platform.target_group_arn_suffix
    LoadBalancer = local.platform.alb_arn_suffix
  }
  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]
  tags          = { Component = "alarm-unhealthy" }
}

# Alarm 6: WAF Blocked Requests Spike
resource "aws_cloudwatch_metric_alarm" "waf_blocked_spike" {
  alarm_name          = "${var.project}-api-waf-blocked-spike-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_waf_block_threshold
  alarm_description   = "WAF blocking a high number of requests"
  treat_missing_data  = "notBreaching"
  dimensions = {
    WebACL = aws_wafv2_web_acl.api.name
    Region = var.aws_region
    Rule   = "ALL"
  }
  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]
  tags          = { Component = "alarm-waf" }
}

# ── Reconciliation Alarms ────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "reconciliation_delta_nonzero" {
  alarm_name          = "${var.project}-reconciliation-absdelta-nonzero-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AbsDelta"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "WARNING: Reconciliation absolute delta is > 0 sats"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  tags                = { Component = "reconciliation", Severity = "warning" }
}

resource "aws_cloudwatch_metric_alarm" "reconciliation_delta_critical" {
  alarm_name          = "${var.project}-reconciliation-absdelta-critical-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AbsDelta"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 1000
  alarm_description   = "CRITICAL: Reconciliation absolute delta > 1000 sats"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  tags                = { Component = "reconciliation", Severity = "critical" }
}

resource "aws_cloudwatch_metric_alarm" "reconciliation_mismatch_count" {
  alarm_name          = "${var.project}-reconciliation-mismatch-count-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "MismatchCount"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Reconciliation found mismatched payouts"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  tags                = { Component = "reconciliation", Severity = "warning" }
}

# ── Signing Alarm ────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "sign_pending_stuck" {
  alarm_name          = "${var.project}-sign-pending-stuck-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SignPendingCount"
  namespace           = "Koya/Signing"
  period              = 600
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "PSBTs stuck in signing_pending > 10 minutes"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  tags                = { Component = "psbt-signing", Severity = "critical" }
}
