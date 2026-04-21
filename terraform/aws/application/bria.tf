locals {
  bria_secret_arns = data.terraform_remote_state.platform.outputs.secret_arns
  bria_image_uri   = "${data.terraform_remote_state.platform.outputs.ecr_bria_repository_url}:${var.bria_image_tag}"
}

resource "aws_service_discovery_private_dns_namespace" "bria" {
  name = var.bria_private_dns_namespace
  vpc  = local.foundation.vpc_id

  tags = {
    Component = "service-discovery"
  }
}

resource "aws_service_discovery_service" "bria" {
  name = var.bria_private_dns_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.bria.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = {
    Component = "service-discovery"
  }
}

resource "aws_security_group" "bria" {
  name        = "${var.project}-bria-sg-${var.environment}"
  description = "Private Bria gRPC service"
  vpc_id      = local.foundation.vpc_id

  tags = {
    Name      = "${var.project}-bria-sg-${var.environment}"
    Component = "bria"
  }
}

resource "aws_security_group" "bria_db" {
  name        = "${var.project}-bria-db-sg-${var.environment}"
  description = "Bria PostgreSQL access"
  vpc_id      = local.foundation.vpc_id

  tags = {
    Name      = "${var.project}-bria-db-sg-${var.environment}"
    Component = "bria"
  }
}

resource "aws_vpc_security_group_ingress_rule" "bria_from_api" {
  security_group_id            = aws_security_group.bria.id
  referenced_security_group_id = local.foundation.ecs_security_group_id
  from_port                    = var.bria_port
  to_port                      = var.bria_port
  ip_protocol                  = "tcp"
  description                  = "API tasks to Bria gRPC"
}

resource "aws_vpc_security_group_ingress_rule" "bria_from_private_ops" {
  security_group_id            = aws_security_group.bria.id
  referenced_security_group_id = aws_security_group.bria.id
  from_port                    = var.bria_port
  to_port                      = var.bria_port
  ip_protocol                  = "tcp"
  description                  = "Private ops tasks to Bria gRPC"
}

resource "aws_vpc_security_group_ingress_rule" "bria_admin_from_private_ops" {
  security_group_id            = aws_security_group.bria.id
  referenced_security_group_id = aws_security_group.bria.id
  from_port                    = var.bria_admin_port
  to_port                      = var.bria_admin_port
  ip_protocol                  = "tcp"
  description                  = "Private ops tasks to Bria admin gRPC"
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_bria_service" {
  security_group_id            = local.foundation.ecs_security_group_id
  referenced_security_group_id = aws_security_group.bria.id
  from_port                    = var.bria_port
  to_port                      = var.bria_port
  ip_protocol                  = "tcp"
  description                  = "API tasks to private Bria service"
}

resource "aws_vpc_security_group_ingress_rule" "bria_db_from_bria" {
  security_group_id            = aws_security_group.bria_db.id
  referenced_security_group_id = aws_security_group.bria.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Bria tasks to Bria PostgreSQL"
}

resource "aws_vpc_security_group_egress_rule" "bria_to_db" {
  security_group_id            = aws_security_group.bria.id
  referenced_security_group_id = aws_security_group.bria_db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Bria to PostgreSQL"
}

resource "aws_vpc_security_group_egress_rule" "bria_dns_tcp" {
  security_group_id = aws_security_group.bria.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
  description       = "Bria DNS TCP"
}

resource "aws_vpc_security_group_egress_rule" "bria_dns_udp" {
  security_group_id = aws_security_group.bria.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
  description       = "Bria DNS UDP"
}

resource "aws_vpc_security_group_egress_rule" "bria_outbound_tcp" {
  security_group_id = aws_security_group.bria.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 1
  to_port           = 65535
  ip_protocol       = "tcp"
  description       = "Bria outbound TCP (Electrum + AWS APIs)"
}

resource "aws_db_subnet_group" "bria" {
  name       = "${var.project}-bria-db-subnets-${var.environment}"
  subnet_ids = local.foundation.private_subnet_ids

  tags = {
    Component = "bria"
  }
}

resource "aws_db_instance" "bria" {
  identifier                   = "${var.project}-bria-${var.environment}"
  engine                       = "postgres"
  engine_version               = "16.4"
  instance_class               = var.bria_db_instance_class
  allocated_storage            = var.bria_db_allocated_storage
  db_subnet_group_name         = aws_db_subnet_group.bria.name
  vpc_security_group_ids       = [aws_security_group.bria_db.id]
  publicly_accessible          = false
  username                     = var.bria_db_username
  db_name                      = var.bria_db_name
  manage_master_user_password  = true
  storage_encrypted            = true
  backup_retention_period      = var.environment == "production" ? 7 : 1
  deletion_protection          = var.environment == "production"
  skip_final_snapshot          = true
  auto_minor_version_upgrade   = true
  apply_immediately            = true
  performance_insights_enabled = true

  tags = {
    Component = "bria"
  }
}

data "aws_secretsmanager_secret_version" "bria_db_master" {
  secret_id = aws_db_instance.bria.master_user_secret[0].secret_arn
}

resource "aws_secretsmanager_secret_version" "bria_pg_connection" {
  secret_id = "/koya/bria/pgConnection"
  secret_string = format(
    "postgres://%s:%s@%s:5432/%s",
    var.bria_db_username,
    urlencode(jsondecode(data.aws_secretsmanager_secret_version.bria_db_master.secret_string).password),
    aws_db_instance.bria.address,
    var.bria_db_name,
  )
}

resource "aws_ecs_task_definition" "bria" {
  family                   = "${var.project}-bria-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.bria_cpu
  memory                   = var.bria_memory
  execution_role_arn       = local.foundation.ecs_execution_role_arn
  task_role_arn            = local.foundation.bria_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "${var.project}-bria"
      image     = local.bria_image_uri
      essential = true
      command   = ["bria", "daemon", "run"]

      portMappings = [
        {
          containerPort = var.bria_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "BRIA_HOME", value = "/bria" },
        { name = "BRIA_CONFIG_TEMPLATE", value = "/etc/bria/bria.yml.tpl" },
        { name = "BRIA_CONFIG", value = "/tmp/bria.yml" },
        { name = "BRIA_NETWORK", value = var.bria_network },
        { name = "BRIA_ELECTRUM_URL", value = var.bria_electrum_url },
        { name = "RUST_LOG", value = "info" }
      ]

      secrets = [
        { name = "PG_CON", valueFrom = local.bria_secret_arns["/koya/bria/pgConnection"] },
        { name = "SIGNER_ENCRYPTION_KEY", valueFrom = local.bria_secret_arns["/koya/bria/signerEncryptionKey"] }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.foundation.bria_log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "bria"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "nc -z 127.0.0.1 ${var.bria_port} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Component = "bria"
  }
}

resource "aws_ecs_service" "bria" {
  name            = "${var.project}-bria-service-${var.environment}"
  cluster         = local.platform.ecs_cluster_arn
  task_definition = aws_ecs_task_definition.bria.arn
  desired_count   = var.bria_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.foundation.private_subnet_ids
    security_groups  = [aws_security_group.bria.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.bria.arn
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  tags = {
    Component = "bria"
  }
}
