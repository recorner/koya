# ── Platform Layer Outputs ────────────────────────────────────────

# ECR
output "ecr_repository_url" {
  value       = aws_ecr_repository.api.repository_url
  description = "ECR repository URL for API images"
}

output "ecr_bria_repository_url" {
  value       = aws_ecr_repository.bria.repository_url
  description = "ECR repository URL for Bria images"
}

# ECS
output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ECS cluster ARN"
}

# ALB
output "alb_arn" {
  value       = aws_lb.api.arn
  description = "ALB ARN"
}

output "alb_arn_suffix" {
  value       = aws_lb.api.arn_suffix
  description = "ALB ARN suffix (for CloudWatch dimensions)"
}

output "alb_dns_name" {
  value       = aws_lb.api.dns_name
  description = "ALB DNS name"
}

output "target_group_arn" {
  value       = aws_lb_target_group.api.arn
  description = "Target group ARN"
}

output "target_group_arn_suffix" {
  value       = aws_lb_target_group.api.arn_suffix
  description = "Target group ARN suffix (for CloudWatch dimensions)"
}

# TLS
output "acm_certificate_arn" {
  value       = aws_acm_certificate.api.arn
  description = "ACM certificate ARN"
}

# Secrets — ARN map for task definitions
output "secret_arns" {
  value = {
    for k, v in aws_secretsmanager_secret.koya : k => v.arn
  }
  description = "Map of secret path → ARN"
}
