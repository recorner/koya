# ── CloudWatch Log Groups ────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project}-api-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Component = "logs"
  }
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${var.project}-migrate-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Component = "logs"
  }
}
