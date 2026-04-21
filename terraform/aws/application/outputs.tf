# ── Application Layer Outputs ─────────────────────────────────────

output "api_task_definition_arn" {
  value       = aws_ecs_task_definition.api.arn
  description = "API task definition ARN"
}

output "migrate_task_definition_arn" {
  value       = aws_ecs_task_definition.migrate.arn
  description = "Migrate task definition ARN"
}

output "api_service_name" {
  value       = aws_ecs_service.api.name
  description = "ECS API service name"
}

output "bria_service_name" {
  value       = aws_ecs_service.bria.name
  description = "ECS Bria service name"
}

output "bria_task_definition_arn" {
  value       = aws_ecs_task_definition.bria.arn
  description = "Bria task definition ARN"
}

output "bria_private_host" {
  value       = "${aws_service_discovery_service.bria.name}.${aws_service_discovery_private_dns_namespace.bria.name}"
  description = "Private DNS host for Bria gRPC API"
}

output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.api.arn
  description = "WAF web ACL ARN"
}

output "psbt_archive_bucket_name" {
  value       = aws_s3_bucket.psbt_archive.id
  description = "PSBT archive S3 bucket name"
}

output "psbt_archive_kms_key_arn" {
  value       = aws_kms_key.psbt_archive.arn
  description = "PSBT archive KMS key ARN"
}

output "ingress_alerts_topic_arn" {
  value       = aws_sns_topic.ingress_alerts.arn
  description = "Ingress alerts SNS topic ARN"
}

output "reconciliation_alerts_topic_arn" {
  value       = aws_sns_topic.reconciliation_alerts.arn
  description = "Reconciliation alerts SNS topic ARN"
}
