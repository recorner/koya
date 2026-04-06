# ── Foundation Layer Outputs ──────────────────────────────────────
# Consumed by the platform and application layers.

# VPC
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Private subnet IDs"
}

# Security Groups
output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "ALB security group ID"
}

output "ecs_security_group_id" {
  value       = aws_security_group.ecs.id
  description = "ECS tasks security group ID"
}

# IAM Roles
output "ecs_execution_role_arn" {
  value       = aws_iam_role.ecs_execution.arn
  description = "ECS execution role ARN"
}

output "api_task_role_arn" {
  value       = aws_iam_role.api_task.arn
  description = "API task role ARN"
}

output "migrate_task_role_arn" {
  value       = aws_iam_role.migrate_task.arn
  description = "Migrate task role ARN"
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions_deploy.arn
  description = "GitHub Actions deploy role ARN"
}

# Log Groups
output "api_log_group_name" {
  value       = aws_cloudwatch_log_group.api.name
  description = "API CloudWatch log group name"
}

output "migrate_log_group_name" {
  value       = aws_cloudwatch_log_group.migrate.name
  description = "Migrate task CloudWatch log group name"
}

# Region & Account
output "aws_region" {
  value       = var.aws_region
  description = "AWS region"
}

output "aws_account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "AWS account ID"
}
