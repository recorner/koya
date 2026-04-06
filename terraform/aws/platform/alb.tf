# ── Application Load Balancer ────────────────────────────────────

locals {
  foundation = data.terraform_remote_state.foundation.outputs
}

resource "aws_lb" "api" {
  name               = "${var.project}-api-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [local.foundation.alb_security_group_id]
  subnets            = local.foundation.public_subnet_ids

  enable_deletion_protection = var.environment == "production" ? true : false

  tags = {
    Component = "alb"
  }
}

# ── Target Group ─────────────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  name        = "${var.project}-api-tg-${var.environment}"
  port        = 3333
  protocol    = "HTTP"
  vpc_id      = local.foundation.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/v1/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Component = "alb"
  }
}

# ── ACM Certificate ──────────────────────────────────────────────

resource "aws_acm_certificate" "api" {
  domain_name       = "${var.api_subdomain}.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Component = "tls"
  }
}

# DNS validation record (only if Route53 zone is provided)
resource "aws_route53_record" "acm_validation" {
  for_each = var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "api" {
  count = var.route53_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

# ── HTTPS Listener ───────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = {
    Component = "alb"
  }
}

# ── HTTP → HTTPS Redirect ───────────────────────────────────────

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Component = "alb"
  }
}

# ── Route53 DNS Record ──────────────────────────────────────────

resource "aws_route53_record" "api" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}
