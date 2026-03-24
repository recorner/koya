Context: We have Step 14 & 15 implemented (DFNS SDK, Bria PSBT signing flow, Redis cursor, PSBT retention skeleton, reconciliation job). Now implement full production ops and local/staging testing so we can remove mocks and start heavy testing.

Owner: implement in westronet/koya monorepo. Use Nx/pnpm/NestJS/Prisma. Secrets in AWS Secrets Manager. Monitoring via CloudWatch. Runbook owner @recorner.

Scope (deliverables)

Implement these items and open PRs (or a single PR broken into smaller commits):

S3 archival implementation (PR)
Implement S3 upload in PsbtRetentionService (KMS encrypted), update retention job to archive then clear DB blob, unit tests, Terraform snippet for S3 + KMS, and restore playbook.
CloudWatch alarm + SNS (PR/Terraform)
Add putMetricData in ReconciliationService, create CloudWatch alarm(s) for discrepancies, create SNS topic and subscription to notify @recorner (PagerDuty/Slack/email). Provide Terraform or AWS CLI.
Nightly self-hosted runner guide + GH Actions job ready
Produce CloudFormation/EC2 user-data script to provision runner, register it with GH Actions, install Docker, configure AWS credentials, and provide nightly-dfns-integration.yml job.
DFNS mTLS rotation script & ECS secret mapping
Script to rotate certs in AWS Secrets Manager and update ECS task definition (or Docker compose secret mounts). Add CI check for cert expiry.
Circuit breaker + sign-latency alert
Add circuit-breaker to PsbtSigningService (Redis-backed or in-memory with Redis fallback) and CloudWatch metric + alarm for sign-pending > 10m.
Integration-run script & DFNS mock
Add scripts/run-dfns-mock.sh and scripts/dfns-mock/ mock server, and a scripts/run-integration.sh to bring up stack and run the smoke test.
Full runbook expansion
Expand docs/deployment/dfns-mtls.md with all required steps: Secrets Manager commands, Docker/ECS secret examples, health check troubleshooting, cert rotation, reconciliation playbook, and how to run nightly job.
PRE-REQUISITES (do before coding)
Confirm payout_psbts table exists (Step 14 migration).
Ensure Redis is available and koya:cursor:bria_event_consumer key works.
Ensure Bria + Bria-PG + Koya API + DFNS sandbox credentials are available.
Ensure AWS account + IAM user/role to create S3/KMS/SNS/CloudWatch/Secrets Manager resources.
Ensure self-hosted runner AWS permissions to register with GitHub (or provide admin token).
Deliverable 1 — S3 archival for PSBT retention
Files to edit/create
apps/api/src/ops/psbt-retention.service.ts (update)
apps/api/src/ops/psbt-retention.service.spec.ts (unit tests)
terraform/aws/s3_psbt_archive.tf (example Terraform resource)
docs/deployment/psbt-retention.md (playbook and restore)
Implementation details
S3 bucket & KMS (Terraform example)
Create s3://koya-archives encrypted with KMS key:
# terraform/aws/s3_psbt_archive.tf
resource "aws_kms_key" "psbt_archive" {
  description = "KMS key for PSBT archive"
  deletion_window_in_days = 30
}
resource "aws_s3_bucket" "psbt_archive" {
  bucket = "koya-archives"
  acl    = "private"
  force_destroy = false
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "aws:kms"
        kms_master_key_id = aws_kms_key.psbt_archive.arn
      }
    }
  }
  lifecycle_rule {
    id      = "archive-retention"
    enabled = true
    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }
    expiration {
      days = 365*2
    }
  }
}
PSBT retention job (implementation) — apps/api/src/ops/psbt-retention.service.ts:
Inject AWS S3 client (AWS SDK v3) and KMS key id (from env or Secrets Manager).
Daily cron job at 02:00 UTC.
Query: SELECT * FROM payout_psbts WHERE updated_at < now() - INTERVAL '90 days' AND psbt_status IN ('signed','settled','failed').
For each row:
Compress psbt_base64/signed_psbt_base64 into gz (or leave base64) and putObject to S3 path: payout_psbts/YYYY/MM/<externalId>.psbt.gz with SSE-KMS using aws_kms_key.psbt_archive.
After successful upload, UPDATE payout_psbts SET psbt_base64='[archived]', signed_psbt_base64='[archived]', psbt_status='archived', updated_at=now() WHERE id=....
Log S3 path and KMS key id.
Add unit test(s) mocking S3 and DB.
Restore playbook:
To restore, download S3 object, decompress, and insert back into DB or use for audit.
Acceptance
Unit tests added, code uploads archived PSBT to S3 with KMS encryption, DB rows updated to '[archived]', and logs show S3 path.
Deliverable 2 — CloudWatch metric + SNS alarm for reconciliation
Files to edit/create
apps/api/src/ops/reconciliation.service.ts (add putMetricData)
terraform/aws/alerts_reconciliation.tf (CloudWatch alarm + SNS topic)
docs/deployment/reconciliation.md (runbook)
Implementation details
Emit metric
Add to ReconciliationService after computing absSum:
// pseudo
await cloudwatch.putMetricData({
  Namespace: 'Koya/Reconciliation',
  MetricData: [{
    MetricName: 'AbsDelta',
    Value: absSum,
    Unit: 'Count', // sats
    Dimensions: [{ Name: 'Environment', Value: process.env.NODE_ENV || 'dev' }]
  }]
});
Terraform alarm + SNS (example):
resource "aws_sns_topic" "reconciliation_alerts" {
  name = "koya-reconciliation-alerts"
}
resource "aws_sns_topic_subscription" "ops_slack" {
  topic_arn = aws_sns_topic.reconciliation_alerts.arn
  protocol  = "https"
  endpoint  = "https://hooks.slack.com/services/..." # or PagerDuty webhook
}
resource "aws_cloudwatch_metric_alarm" "reconciliation_delta" {
  alarm_name          = "koya-reconciliation-absdelta-nonzero"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AbsDelta"
  namespace           = "Koya/Reconciliation"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Alert whenever reconciliation absolute delta is > 0 sats"
  alarm_actions       = [aws_sns_topic.reconciliation_alerts.arn]
  treat_missing_data  = "notBreaching"
}
Escalation
Add another alarm for AbsDelta > 1000 sats or pct > 0.1%; use same SNS.
Acceptance
Reconciliation job calls putMetricData, CloudWatch alarm exists, SNS topic created and subscription to ops exists.
Deliverable 3 — Nightly self-hosted runner & GH Actions job
Files to create
terraform/aws/runner_cf.yml (CloudFormation to provision EC2 runner AMI and user-data).
scripts/setup-self-hosted-runner.sh (installs Docker, runner agent, config).
.github/workflows/nightly-dfns-integration.yml (complete ready job).
docs/deployment/nightly-runner.md
Highlights
EC2 user-data (example steps):
Install Docker, Docker Compose.
Install GitHub runner agent and configure as self-hosted (requires GH runner token created and stored in Secrets Manager).
Install AWS CLI and jq.
Ensure runner has IAM role for Secrets Manager access and S3 upload.
GH Actions job (See earlier skeleton). Add a step to fetch secrets from Secrets Manager via AWS CLI and write them to docker/secrets/ before docker compose up.
Provisioning:
Use CloudFormation/TF to create IAM role, Security Group, EC2 with EBS, Auto-Scaling optional.
Acceptance
AMI/user-data script able to instantiate a runner that registers to GH and runs nightly job.
Deliverable 4 — DFNS mTLS rotation script & ECS secret mapping
Files to create
scripts/rotate-dfns-mtls.sh (bash script)
docs/deployment/dfns-mtls.md (ops doc with commands)
Example ECS task def patch script: scripts/update-ecs-task-secret.sh
Rotation script (sketch)
Inputs: --cert-file, --key-file, --ca-file, --secret-prefix=/koya/dfns/mTLS, --region.
Steps:
aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/cert --secret-string file://cert.pem
same for key and ca.
Update ECS task definition (register-new-task-def JSON, update containerDefinition secrets ARN references or SSM param refs). Example for ECS:
create new revision with secrets or environment with valueFrom: arn:aws:secretsmanager:....
Force new deployment of service.
CI check for cert expiry
Add a small script scripts/check-cert-expiry.sh that:
fetches cert from Secrets Manager,
uses openssl x509 -enddate -noout and exit non-zero if expiry < 14 days.
Add this as a CI job or pre-deploy check.
Acceptance
Rotation script pushes certs to Secrets Manager and triggers ECS service redeploy. Pre-deploy check warns/blocks if certs close to expiry.
Deliverable 5 — Circuit breaker + sign-latency alert
Files to edit
apps/api/src/conversion/psbt-signing.service.ts (add Circuit-breaker)
apps/api/src/ops/reconciliation.service.ts (add putMetricData for SignPendingCount and SignPendingLatency)
terraform/aws/alerts_signing.tf (CloudWatch alarm for sign-pending > 10m)
Implementation
Use Redis to store circuit state: koya:cb:psbt_signing with counts and openUntil.
On transient errors increment failure counter; if failures exceed threshold (e.g., 5 in 10 min), open circuit for 15 minutes.
Track PSBT sign pending times: push metric to CloudWatch SignPendingLatency when a PSBT is pending > 10m. CloudWatch alarm triggers SNS.
Acceptance
Circuit breaker trips under failure flood, prevents repeated immediate retries, and CloudWatch alarm fires when sign pending > 10m.
Deliverable 6 — DFNS mock + integration-run script
Files to create
scripts/dfns-mock/server.js (Node/Express or Fastify):
POST /v1/sign-psbt accepts PSBT and returns signed PSBT, stores idempotency-key in memory (or simple file), returns 409 if seen before.
POST /v1/webhook sends webhook to target with HMAC signature header.
scripts/run-dfns-mock.sh to start server in background.
scripts/run-integration.sh to:
export necessary envs,
start Docker compose integration (Bria, bria-pg, redis, api, dfns-mock),
run smoke tests pnpm nx e2e dfns-integration, collect logs, shut down.
Acceptance
./scripts/run-integration.sh executes full flow locally and produces a success report.
Deliverable 7 — Full runbook expansion
Files to update
docs/deployment/dfns-mtls.md — add:
Secrets Manager commands to store certs,
ECS and compose mounting examples,
Healthcheck troubleshooting steps,
Cert rotation steps with scripts/rotate-dfns-mtls.sh,
Reconciliation alert triage steps,
On-call escalation: @recorner.
Tests & CI
Unit tests for new services (psbt-retention, cursor store, reconciliation metrics).
Integration tests for DFNS-sign flow using dfns-mock.
Add nightly GitHub Actions workflow using a self-hosted runner with Docker; ensure secrets pulled from AWS Secrets Manager at runtime.
Example curl commands (for quick manual testing)

Sign PSBT (sandbox fallback)

curl -H "Authorization: Bearer ${DFNS_API_KEY}" \
     -H "Idempotency-Key: koya:conversion:abc123" \
     -H "Content-Type: application/json" \
     -d '{"externalId":"koya:conversion:abc123","psbt":"<base64>","psbtId":"uuid-psbt","walletId":"dfns-wallet-1"}' \
     "${DFNS_API_URL}/v1/sign-psbt"

Replay DFNS webhook

body='{"externalId":"koya:conversion:abc123","dfnsRequestId":"dfns-req-123","status":"COMPLETED","dfnsTxId":"txid..."}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$DFNS_WEBHOOK_SECRET" -binary | openssl base64)
curl -H "Content-Type: application/json" -H "X-DFNS-Signature: ${sig}" \
     -d "$body" http://localhost:3333/api/v1/dfns/webhook
Acceptance checklist (final)
 S3 archival implemented and tested, DB blob replaced by [archived] marker, archives in S3 with KMS encryption.
 Reconciliation job writes AbsDelta metric; CloudWatch alarm + SNS created and notifies @recorner.
 Nightly runner CloudFormation + setup script and GH Actions job created.
 DFNS mTLS rotation script and ECS secret mapping script added; pre-deploy cert expiry check added to CI.
 Circuit breaker added to signing flow; CloudWatch sign-latency alarm created.
 scripts/dfns-mock exists and scripts/run-integration.sh runs full smoke locally.
 Full runbook updated with steps and on-call instructions.