# ── ECS Task Definitions & Service ────────────────────────────────

locals {
  foundation = data.terraform_remote_state.foundation.outputs
  platform   = data.terraform_remote_state.platform.outputs
  secrets    = local.platform.secret_arns
}

# ── API Task Definition ──────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = local.foundation.ecs_execution_role_arn
  task_role_arn            = local.foundation.api_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "${var.project}-api"
      image     = "${local.platform.ecr_repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.api_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = var.node_env },
        { name = "PORT", value = tostring(var.api_port) },
        { name = "MPESA_SHORTCODE", value = var.mpesa_shortcode },
        { name = "MPESA_DRIVER", value = var.mpesa_driver },
        { name = "MPESA_ENVIRONMENT", value = var.mpesa_environment },
        { name = "BTC_DELIVERY_DRIVER", value = var.btc_delivery_driver },
        { name = "CORS_ORIGINS", value = var.cors_origins },
        { name = "REDIS_HOST", value = var.redis_host },
        { name = "REDIS_PORT", value = var.redis_port },
        { name = "REDIS_TLS", value = var.redis_tls },
        { name = "REDIS_DB", value = var.redis_db },
        { name = "CLOUDWATCH_METRICS_ENABLED", value = var.cloudwatch_metrics_enabled },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "BRIA_API_HOST", value = var.bria_api_host },
        { name = "BRIA_API_PORT", value = var.bria_api_port },
        { name = "DFNS_API_URL", value = var.dfns_api_url },
        { name = "DFNS_APP_ID", value = var.dfns_app_id },
        { name = "DFNS_WALLET_ID", value = var.dfns_wallet_id },
        { name = "MPESA_CALLBACK_URL", value = var.mpesa_callback_url },
        { name = "DFNS_WEBHOOK_URL", value = var.dfns_webhook_url },
        { name = "BRIA_WALLET_NAME", value = var.bria_wallet_name },
        { name = "BRIA_PAYOUT_QUEUE_NAME", value = var.bria_payout_queue_name },
        { name = "BRIA_XPUB_REF", value = var.bria_xpub_ref },
        { name = "PSBT_ARCHIVE_S3_BUCKET", value = var.psbt_archive_s3_bucket },
        { name = "TRUST_PROXY_HOPS", value = var.trust_proxy_hops },
        { name = "JSON_BODY_LIMIT", value = var.json_body_limit },
        { name = "URLENCODED_BODY_LIMIT", value = var.urlencoded_body_limit },
        { name = "THROTTLE_DEFAULT_LIMIT", value = var.throttle_default_limit },
        { name = "THROTTLE_DEFAULT_TTL_SECONDS", value = var.throttle_default_ttl_seconds },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = local.secrets["/koya/api/DATABASE_URL"] },
        { name = "REDIS_PASSWORD", valueFrom = local.secrets["/koya/api/REDIS_PASSWORD"] },
        { name = "MPESA_CONSUMER_KEY", valueFrom = local.secrets["/koya/daraja/consumerKey"] },
        { name = "MPESA_CONSUMER_SECRET", valueFrom = local.secrets["/koya/daraja/consumerSecret"] },
        { name = "MPESA_PASSKEY", valueFrom = local.secrets["/koya/daraja/passkey"] },
        { name = "DFNS_API_KEY", valueFrom = local.secrets["/koya/dfns/apiKey"] },
        { name = "DFNS_WEBHOOK_SECRET", valueFrom = local.secrets["/koya/dfns/webhookSecret"] },
        { name = "BRIA_API_KEY", valueFrom = local.secrets["/koya/bria/apiKey"] },
        { name = "FX_API_KEY", valueFrom = local.secrets["/koya/api/FX_API_KEY"] },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.foundation.api_log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.api_port}/api/v1/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Component = "ecs-task"
  }
}

# ── Migrate Task Definition ──────────────────────────────────────

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project}-api-migrate-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.migrate_cpu
  memory                   = var.migrate_memory
  execution_role_arn       = local.foundation.ecs_execution_role_arn
  task_role_arn            = local.foundation.migrate_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "${var.project}-api-migrate"
      image     = "${local.platform.ecr_repository_url}:${var.image_tag}"
      essential = true
      command   = ["sh", "/app/scripts/migrate.sh"]

      environment = [
        { name = "NODE_ENV", value = var.node_env }
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = local.secrets["/koya/api/DATABASE_URL"] }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.foundation.api_log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    }
  ])

  tags = {
    Component = "ecs-task"
  }
}

# ── ECS Service ──────────────────────────────────────────────────

resource "aws_ecs_service" "api" {
  name            = "${var.project}-api-service-${var.environment}"
  cluster         = local.platform.ecs_cluster_arn
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.foundation.public_subnet_ids
    security_groups  = [local.foundation.ecs_security_group_id]
    assign_public_ip = var.assign_public_ip
  }

  load_balancer {
    target_group_arn = local.platform.target_group_arn
    container_name   = "${var.project}-api"
    container_port   = var.api_port
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  health_check_grace_period_seconds  = 60

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = {
    Component = "ecs-service"
  }
}
