# ── ALB Security Group ───────────────────────────────────────────
# Allows inbound HTTPS (443) and HTTP (80) from the internet.
# Allows outbound to ECS tasks on port 3333.

resource "aws_security_group" "alb" {
  name        = "${var.project}-alb-sg-${var.environment}"
  description = "ALB ingress: HTTPS/HTTP from internet"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name      = "${var.project}-alb-sg-${var.environment}"
    Component = "alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS from internet"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  description       = "HTTP from internet (redirects to HTTPS)"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 3333
  to_port                      = 3333
  ip_protocol                  = "tcp"
  description                  = "ALB to ECS API tasks"
}

# ── ECS Security Group ──────────────────────────────────────────
# Allows inbound from the ALB on port 3333.
# Allows outbound to external PostgreSQL, Redis, and HTTPS.

resource "aws_security_group" "ecs" {
  name        = "${var.project}-ecs-sg-${var.environment}"
  description = "ECS tasks: ALB ingress + external DB/Redis/HTTPS egress"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name      = "${var.project}-ecs-sg-${var.environment}"
    Component = "ecs"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3333
  to_port                      = 3333
  ip_protocol                  = "tcp"
  description                  = "Traffic from ALB"
}

# Egress: external PostgreSQL
resource "aws_vpc_security_group_egress_rule" "ecs_to_db" {
  count = length(var.db_cidr_blocks)

  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = var.db_cidr_blocks[count.index]
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
  description       = "ECS to external PostgreSQL"
}

# Egress: external Redis
resource "aws_vpc_security_group_egress_rule" "ecs_to_redis" {
  count = length(var.redis_cidr_blocks)

  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = var.redis_cidr_blocks[count.index]
  from_port         = 6379
  to_port           = 6379
  ip_protocol       = "tcp"
  description       = "ECS to external Redis"
}

# Egress: HTTPS (AWS APIs, Daraja, DFNS, rate providers, etc.)
resource "aws_vpc_security_group_egress_rule" "ecs_https" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "ECS to HTTPS (AWS APIs, providers)"
}

# Egress: DNS resolution
resource "aws_vpc_security_group_egress_rule" "ecs_dns_tcp" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
  description       = "DNS (TCP)"
}

resource "aws_vpc_security_group_egress_rule" "ecs_dns_udp" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
  description       = "DNS (UDP)"
}
