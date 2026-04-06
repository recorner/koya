# CloudWatch Alarms — API Ingress & Abuse Monitoring
#
# Alarms:
# 1. High 429 (throttled) rate from ALB
# 2. High ALB 5xx error rate
# 3. High target response time
# 4. Unusually high request count
# 5. Unhealthy target count > 0
# 6. WAF blocked requests spike

variable "sns_ops_topic_arn" {
  type        = string
  description = "ARN of the SNS topic for ops notifications"
  default     = ""
}

variable "alarm_429_threshold" {
  type        = number
  default     = 50
  description = "Number of 429 responses in 5 minutes to trigger alarm"
}

variable "alarm_5xx_threshold" {
  type        = number
  default     = 10
  description = "Number of 5xx responses in 5 minutes to trigger alarm"
}

variable "alarm_latency_threshold_ms" {
  type        = number
  default     = 5000
  description = "Average target response time (ms) to trigger alarm"
}

variable "alarm_request_count_threshold" {
  type        = number
  default     = 10000
  description = "Total request count in 5 minutes to trigger alarm"
}

variable "alarm_waf_block_threshold" {
  type        = number
  default     = 100
  description = "WAF blocked requests in 5 minutes to trigger alarm"
}

# ── SNS Topic for ingress alarms ────────────────────────────────

resource "aws_sns_topic" "ingress_alerts" {
  name = "koya-ingress-alerts-${var.environment}"

  tags = {
    Service     = "koya"
    Component   = "ingress-alerts"
    Environment = var.environment
  }
}

# ── Alarm 1: High 429 Rate ──────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_429_rate" {
  alarm_name          = "koya-api-high-429-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_429_threshold
  alarm_description   = "High rate of 429 (throttled) responses — potential abuse or misconfigured limits"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-429"
    Environment = var.environment
  }
}

# ── Alarm 2: High 5xx Error Rate ────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_5xx_rate" {
  alarm_name          = "koya-api-high-5xx-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_5xx_threshold
  alarm_description   = "High rate of 5xx errors — app instability or dependency failure"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-5xx"
    Environment = var.environment
  }
}

# ── Alarm 3: High Target Response Time ──────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "koya-api-high-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_latency_threshold_ms / 1000
  alarm_description   = "Average response time exceeded ${var.alarm_latency_threshold_ms}ms — potential DB/Redis/provider slowness"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-latency"
    Environment = var.environment
  }
}

# ── Alarm 4: Unusually High Request Count ────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_request_count" {
  alarm_name          = "koya-api-high-request-count-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_request_count_threshold
  alarm_description   = "Unusually high request volume — potential DDoS or viral traffic"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-request-count"
    Environment = var.environment
  }
}

# ── Alarm 5: Unhealthy Target Count ─────────────────────────────

resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  count               = var.alb_target_group_arn_suffix != "" ? 1 : 0
  alarm_name          = "koya-api-unhealthy-targets-${var.environment}"
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
    TargetGroup  = var.alb_target_group_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-unhealthy"
    Environment = var.environment
  }
}

# ── Alarm 6: WAF Blocked Requests Spike ─────────────────────────

resource "aws_cloudwatch_metric_alarm" "waf_blocked_spike" {
  alarm_name          = "koya-api-waf-blocked-spike-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_waf_block_threshold
  alarm_description   = "WAF is blocking a high number of requests — potential attack or false positives"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = "koya-api-waf-${var.environment}"
    Region = "us-east-1"
    Rule   = "ALL"
  }

  alarm_actions = [aws_sns_topic.ingress_alerts.arn]
  ok_actions    = [aws_sns_topic.ingress_alerts.arn]

  tags = {
    Service     = "koya"
    Component   = "alarm-waf"
    Environment = var.environment
  }
}
