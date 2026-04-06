# ECS Service Autoscaling for Koya API
#
# Policies:
# 1. CPU target tracking (60%)
# 2. Memory target tracking (70%)
# 3. ALB request count per target
#
# Environment differences:
#   Staging:    min=1, desired=1, max=4
#   Production: min=2, desired=2, max=10
#
# Usage:
#   cd terraform/aws
#   terraform apply -var="environment=staging"

variable "ecs_cluster_name" {
  type        = string
  default     = "koya-api"
  description = "ECS cluster name"
}

variable "ecs_service_name" {
  type        = string
  default     = "koya-api-service"
  description = "ECS service name"
}

variable "autoscaling_min_capacity" {
  type        = number
  default     = 2
  description = "Minimum number of ECS tasks"
}

variable "autoscaling_max_capacity" {
  type        = number
  default     = 10
  description = "Maximum number of ECS tasks (6 for staging, 10 for production)"
}

variable "autoscaling_cpu_target" {
  type        = number
  default     = 60
  description = "Target CPU utilization percentage"
}

variable "autoscaling_memory_target" {
  type        = number
  default     = 70
  description = "Target memory utilization percentage"
}

variable "autoscaling_request_count_target" {
  type        = number
  default     = 500
  description = "Target ALB request count per target per minute"
}

variable "alb_target_group_arn_suffix" {
  type        = string
  description = "ARN suffix of the ALB target group (e.g., targetgroup/koya-api-tg/abc123)"
  default     = ""
}

variable "alb_arn_suffix" {
  type        = string
  description = "ARN suffix of the ALB (e.g., app/koya-api-alb/abc123)"
  default     = ""
}

# ── Autoscaling Target ──────────────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "service/${var.ecs_cluster_name}/${var.ecs_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# ── CPU Target Tracking ─────────────────────────────────────────

resource "aws_appautoscaling_policy" "cpu" {
  name               = "koya-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value       = var.autoscaling_cpu_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── Memory Target Tracking ──────────────────────────────────────

resource "aws_appautoscaling_policy" "memory" {
  name               = "koya-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }

    target_value       = var.autoscaling_memory_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── ALB Request Count Per Target ────────────────────────────────

resource "aws_appautoscaling_policy" "request_count" {
  count              = var.alb_target_group_arn_suffix != "" ? 1 : 0
  name               = "koya-api-request-count-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${var.alb_arn_suffix}/${var.alb_target_group_arn_suffix}"
    }

    target_value       = var.autoscaling_request_count_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
