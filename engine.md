Goal

Make Koya deployable into a brand-new AWS account with nothing provisioned.

The end state must be:

A fresh AWS account can be bootstrapped entirely from repo code and CLI/Terraform.
Infrastructure is created in layers using Terraform.
Application deployment reads configuration from a single environment file per environment plus AWS Secrets Manager for secrets.
The system can be torn down and recreated cleanly.
The flow aligns with the current Koya architecture and all work already completed:
Vercel web
ECS Fargate API
ALB
WAF
Redis
Bria
DFNS
CloudWatch/SNS
cold-start runbooks
migration task
autoscaling
alarms

This is not a feature task. It is a platform reproducibility and deployment discipline task.

Why this is needed

Current state is good for hardening and day-2 ops, but not yet for greenfield bootstrap.

What is already present:

API hardening in main.ts (helmet, trust proxy, body limits, correlation IDs, graceful shutdown)
ApiSecurityModule with Redis-backed throttling wired into the app
API container no longer runs migrations on normal startup; it starts with node main.js only
WAF Terraform exists, but currently expects an existing alb_arn rather than creating the ALB itself
ECS autoscaling Terraform exists, but assumes an existing ECS cluster/service and optional ALB resource labels
Current ECS task definition still embeds account-specific ARNs, URLs, and config directly, so it is not yet portable to a blank AWS account
Current deploy script still contains fixed account/cluster values and placeholder subnet/SG values

So the missing work is the platform bootstrap + unified config/secrets model.

Read first

Before coding, read:

docs/runbooks/cold-start.md
docs/runbooks/cold-start-checklist.md
docs/runbooks/environment-matrix.md
docs/runbooks/service-dependency-map.md
docs/deployment/ecs-fargate.md
docs/progress/step-20.md
apps/api/src/main.ts
apps/api/src/app/app.module.ts
apps/api/Dockerfile
infra/ecs-task-definition.json
infra/ecs-migrate-task-definition.json
scripts/deploy-api.sh
terraform/aws/waf.tf
terraform/aws/ecs_autoscaling.tf
terraform/aws/alerts_ingress.tf
terraform/aws/alerts_reconciliation.tf
terraform/aws/alerts_signing.tf
terraform/aws/s3_psbt_archive.tf
terraform/aws/runner_cf.yml

Start the PR description with a short note explaining:

what already existed,
why it was insufficient for a blank AWS account,
what this bootstrap layer adds.
Scope
Deliverables

Create a clean-room AWS bootstrap system with these outcomes:

1. Terraform foundation layer

Creates:

VPC
subnets (public/private across at least 2 AZs)
route tables
internet gateway
NAT gateway
security groups
CloudWatch log groups
IAM roles and policies
Route53 zone references / records hooks
ACM certificate resources or documented external prerequisite if DNS validation is separated
2. Terraform platform layer

Creates:

ECR repository for API
ECS cluster
ALB
listeners
target group
ECS service security groups
Secrets Manager secret containers/placeholders
SNS topics
optionally ElastiCache / RDS integration hooks if those are not yet under Terraform
3. Terraform application layer

Creates and wires:

ECS task definition
ECS migrate task definition
ECS API service
WAF attachment
autoscaling
alarms
log retention
DNS records for api.koyabank.com
4. Unified environment + secrets model

Define a clean model where:

non-secret config comes from one file like:
env/staging.env
env/production.env
secrets come from AWS Secrets Manager
task definitions are rendered from these inputs and Terraform outputs
there are no hardcoded account IDs, subnet IDs, SG IDs, or secret ARNs in committed task JSON
5. Bootstrap CLI flow

Provide scripts so an operator can do:

bootstrap remote Terraform state/backend if needed
apply foundation
apply platform
seed secrets containers/placeholders
push image
run migrate task
deploy API service
verify health
deploy web
6. Teardown flow

Provide documented and scripted teardown steps that are safe and ordered.

Required architecture

Use these layers:

Layer A — foundation

Suggested path:

terraform/aws/foundation/

Create:

provider config
backend config template
variables
VPC
subnets
route tables
NAT
IGW
security groups
IAM roles:
ECS execution role
API task role
migrate task role if separate
runner role if needed
CloudWatch log groups
base SNS topics if shared
Layer B — platform

Suggested path:

terraform/aws/platform/

Create:

ECR repo for API
ECS cluster
ALB
listeners
target group
Route53/API DNS wiring
ACM cert if managed here
Secrets Manager secret placeholders
optional Redis/DB connection parameters if infra is external
Layer C — application

Suggested path:

terraform/aws/application/

Create:

API task definition from template
migrate task definition from template
ECS service
WAF
autoscaling
CloudWatch alarms
service discovery if needed
Unified config model
1. Non-secret config files

Create:

env/staging.env
env/production.env
env/integration.env

These files must contain only non-secret config, such as:

region
environment
API hostnames
Bria host/port
DFNS API URL
callback URLs
throttle defaults
body limits
feature flags
bucket names
cluster/service names
scaling limits

Do not store secrets in these files.

2. Secrets Manager mapping

Create a machine-readable mapping file, for example:

infra/secrets-map.json

This should define logical secret names such as:

DATABASE_URL
REDIS_PASSWORD
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
DFNS_API_KEY
DFNS_WEBHOOK_SECRET
BRIA_API_KEY
FX_API_KEY

The deploy/bootstrap scripts should read this map and create empty placeholder secrets or update existing ones.

3. Task definition templating

Replace committed static task definitions with templates, for example:

infra/templates/ecs-task-definition.tpl.json
infra/templates/ecs-migrate-task-definition.tpl.json

Render them from:

env file values
Terraform outputs
secret ARNs from Secrets Manager

The committed output should not hardcode:

AWS account IDs
subnet IDs
SG IDs
secret ARNs
environment-specific URLs
Scripts to create/update
1. scripts/bootstrap-aws.sh

Purpose:

initialize Terraform backend or validate it
create or validate required bootstrap resources
run terraform init/plan/apply in the right order

Should support:

./scripts/bootstrap-aws.sh foundation staging
./scripts/bootstrap-aws.sh platform staging
./scripts/bootstrap-aws.sh application staging
2. scripts/load-env.sh

Purpose:

load one .env file once
export values safely
validate required vars are present
make them available to render scripts and Terraform
3. scripts/sync-secrets.sh

Purpose:

read infra/secrets-map.json
create missing Secrets Manager secrets
optionally update values from local operator environment when explicitly requested
never print secret values to stdout
4. scripts/render-task-definitions.sh

Purpose:

render ECS task definition JSON from templates using:
env file values
Terraform outputs
secret ARNs
5. scripts/deploy-api.sh

Refactor existing script so it:

does not hardcode account ID, cluster, service, subnet, SG
reads env file once
pulls needed Terraform outputs automatically
runs migrate task
then deploys API service
6. scripts/destroy-environment.sh

Purpose:

destroy the application layer first
then platform
then foundation if requested
include clear protections and confirmations
Terraform details
Foundation must create or manage
aws_vpc
aws_subnet public/private
aws_route_table
aws_nat_gateway
aws_internet_gateway
aws_security_group
aws_iam_role
aws_iam_policy_attachment
aws_cloudwatch_log_group
Platform must create or manage
aws_ecr_repository
aws_ecs_cluster
aws_lb
aws_lb_target_group
aws_lb_listener
aws_route53_record
aws_acm_certificate if automated here
aws_secretsmanager_secret
Application must create or manage
aws_ecs_task_definition
aws_ecs_service
aws_wafv2_web_acl
aws_wafv2_web_acl_association
aws_appautoscaling_target
aws_appautoscaling_policy
aws_cloudwatch_metric_alarm
aws_sns_topic_subscription
Deployment behavior requirements
A. New AWS account bootstrap

A fresh operator should be able to:

configure AWS credentials
set one environment file
create secrets
run bootstrap scripts
build/push image
deploy API
verify API health
deploy web
B. No duplicated config sources

After this change:

task definitions should not be hand-edited
cluster/service names should not be duplicated across multiple scripts
account IDs should not be committed in runtime files
env files should be the single non-secret source of truth
C. Secrets handling

Secrets must:

live in Secrets Manager
be referenced by logical name or generated ARN
never be committed
be documented clearly in the runbooks
Documentation updates required

Update or create:

docs/runbooks/cold-start.md
docs/runbooks/cold-start-checklist.md
docs/runbooks/environment-matrix.md
docs/runbooks/service-dependency-map.md
docs/deployment/ecs-fargate.md

Add a new doc:

docs/runbooks/aws-bootstrap.md

That doc must include:

how to bootstrap a brand-new AWS account
how to populate secrets
how to deploy staging
how to deploy production
how to tear down safely
how to recover from a failed bootstrap
Migration flow

The current split migration pattern is correct and must remain:

API container starts with node main.js only
migrations run as a separate ECS task via deploy orchestration

But refactor it so the migrate task is:

rendered from template
environment-specific
not hardcoded to one account/cluster/subnet/SG
Testing requirements

Add validation for:

rendering task definitions from env + outputs
missing required env detection
missing secret mapping detection
Terraform plan for each layer
deploy script dry-run mode if feasible

At minimum:

unit tests for env loader and template rendering
one script validation test for required vars
one documented dry-run flow
PR summary requirements

At the end of the work, include:

what prevented a blank-account bootstrap before
what layers exist now
what is still manual, if anything
exact operator flow to create staging from zero
exact operator flow to tear it down
Important constraints
Do not break the current staging/production deploy flow while refactoring.
Preserve current hardening:
helmet, trust proxy, body limits, correlation IDs, shutdown hooks
ApiSecurityModule with Redis throttling
migrations separate from normal startup
Prefer small composable Terraform modules over one giant file.
Keep AWS region configurable, default us-east-1.
Acceptance criteria

This task is complete when:

a brand-new AWS account can be prepared from repo scripts + Terraform
infra is provisioned in layers
env config comes from a single environment file
secrets come from Secrets Manager
ECS task definitions are rendered, not hardcoded
deploy and teardown are both documented and repeatable
cold-start docs align with the new bootstrap model