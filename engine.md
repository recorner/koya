Implement production-grade operational tooling and integration tests so Koya can run heavy staging tests with real DFNS signing (mTLS), remove mocks, and verify end-to-end PSBT signing/broadcast and reconciliation.

Important repo & infra assumptions
Repo: westronet/koya (Nx monorepo).
Bria adapter exists: libs/bria-adapter and provides createPayoutPSBT, submitSignedPsbt, and event subscription methods.
PSBT metadata table payout_psbts exists (Step 14).
Redis already configured and available via REDIS_URL.
DFNS sandbox credentials exist (PAT, JWT, mTLS certs) and will be stored in AWS Secrets Manager.
QuickNode testnet RPC URL will be used for broadcasting/verification.
AWS region: us-east-1.
Notifications: Slack + OneUptime via SNS. Secrets kept in AWS Secrets Manager.
Runner: self-hosted EC2 in us-east-1, instance t3.medium. Ops will create the IAM role for the runner and provide its ARN.
High-level delivery list (A→G)
A. S3 Archival for PSBT retention (90 days) with KMS encryption, Terraform, tests, and restore playbook.
B. CloudWatch metrics + SNS alarms for reconciliation (AbsDelta + MismatchCount), Terraform, SNS → Slack & OneUptime subscriptions.
C. Nightly self-hosted EC2 runner (CloudFormation/Terraform or CF template), runner setup script, and GH Actions nightly job.
D. DFNS mTLS rotation scripts, ECS secret mapping, and cert expiry CI check.
E. Redis-backed circuit-breaker + sign-latency CloudWatch metric & alarm.
F. Integration-run script that uses real DFNS sandbox (mTLS) + QuickNode; optional DFNS mock fallback.
G. Full runbook updates.

Below each deliverable I give (1) exact files to add/edit, (2) code or Terraform snippets, (3) tests, and (4) acceptance criteria. Implementers: keep commits small and open a single PR that groups logical changes (e.g., retention + Terraform, monitoring + Terraform, runner + GH Actions, rotation + scripts).

PREP STEPS (before coding)
Move the DFNS mTLS certs and JWT into AWS Secrets Manager (we’ll reference these ARNs). See D scripts below.
Ensure QUICKNODE_RPC_URL is available for integration tests.
Ops: create IAM role for self-hosted runner with SecretsManager read, S3 put/get, CloudWatch putMetricData, ECS update, and Logs access. Provide the runner IAM role ARN in PR description or via Secrets Manager.
A — S3 Archival for PSBT Retention
Files to add/modify
apps/api/src/ops/psbt-retention.service.ts — implement archival to S3 (KMS) & DB update.
apps/api/src/ops/__tests__/psbt-retention.service.spec.ts — unit tests.
terraform/aws/s3_psbt_archive.tf — S3 bucket + KMS + lifecycle.
docs/deployment/psbt-retention.md — playbook & restore steps.
Key details & code

Prisma table (already present; ensure fields): payout_psbts with psbt_base64, signed_psbt_base64, psbt_status, external_id, txid, updated_at.

Service (TypeScript) — sketch:

// apps/api/src/ops/psbt-retention.service.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { gzipSync } from "zlib";
import { PrismaClient } from '@prisma/client';

export class PsbtRetentionService {
  constructor(private prisma = new PrismaClient(), private s3 = new S3Client({ region: process.env.AWS_REGION })) {}
  async archiveOldPsbts() {
    const rows = await this.prisma.payoutPsbt.findMany({
      where: {
        updatedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        psbtStatus: { in: ['signed','settled','failed'] }
      }
    });
    for (const r of rows) {
      const payload = JSON.stringify({ psbt: r.psbtBase64, signed: r.signedPsbtBase64 });
      const gz = gzipSync(Buffer.from(payload));
      const key = `payout_psbts/${r.createdAt.getUTCFullYear()}/${(r.createdAt.getUTCMonth()+1).toString().padStart(2,'0')}/${r.externalId}.psbt.gz`;
      await this.s3.send(new PutObjectCommand({
        Bucket: process.env.PSBT_ARCHIVE_BUCKET,
        Key: key,
        Body: gz,
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: process.env.PSBT_KMS_KEY_ID
      }));
      await this.prisma.payoutPsbt.update({
        where: { id: r.id },
        data: { psbtBase64: '[archived]', signedPsbtBase64: '[archived]', psbtStatus: 'archived' }
      });
    }
  }
}

Terraform example (skeleton):

# terraform/aws/s3_psbt_archive.tf
resource "aws_kms_key" "psbt_archive" {
  description = "KMS key for Koya PSBT archive"
  enable_key_rotation = true
}
resource "aws_s3_bucket" "psbt_archive" {
  bucket = "koya-archives"
  versioning { enabled = true }
  server_side_encryption_configuration { rule { apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" kms_master_key_id = aws_kms_key.psbt_archive.arn } } }
  lifecycle_rule {
    enabled = true
    transition { days = 365 storage_class = "STANDARD_IA" }
    expiration { days = 365 * 2 }
  }
  block_public_acls = true
  force_destroy = false
}

Tests

Mock S3 client; verify upload called and DB updated. Verify that upload failure does NOT clear DB.

Acceptance

Running job uploads an S3 object and updates DB row. If S3 fails, DB unchanged.
B — CloudWatch metrics + SNS alarms (Reconciliation)
Files to add/modify
apps/api/src/ops/reconciliation.service.ts — add putMetricData for AbsDelta and MismatchCount.
terraform/aws/alerts_reconciliation.tf — SNS + CloudWatch alarms + topic subscriptions.
docs/deployment/reconciliation.md — runbook & triage steps.
Implementation

CloudWatch putMetricData snippet:

await cloudwatch.putMetricData({
  Namespace: 'Koya/Reconciliation',
  MetricData: [
    { MetricName: 'AbsDelta', Value: absDelta, Unit: 'Count', Dimensions: [{ Name: 'Environment', Value: process.env.NODE_ENV }] },
    { MetricName: 'MismatchCount', Value: mismatchCount, Unit: 'Count', Dimensions: [{ Name: 'Environment', Value: process.env.NODE_ENV }] }
  ]
});

Terraform alarm skeleton:

resource "aws_sns_topic" "recon_alerts" { name = "koya-recon-alerts" }
resource "aws_cloudwatch_metric_alarm" "recon_nonzero" {
  alarm_name = "koya-recon-nonzero"
  namespace = "Koya/Reconciliation"
  metric_name = "AbsDelta"
  statistic = "Maximum"
  period = 86400
  evaluation_periods = 1
  threshold = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions = [aws_sns_topic.recon_alerts.arn]
}
# subscription
resource "aws_sns_topic_subscription" "slack" {
  topic_arn = aws_sns_topic.recon_alerts.arn
  protocol = "https"
  endpoint = var.slack_webhook_url  # stored in secrets manager, pass via var
}
resource "aws_sns_topic_subscription" "oneuptime" {
  topic_arn = aws_sns_topic.recon_alerts.arn
  protocol = "https"
  endpoint = var.oneuptime_webhook_url
}

Acceptance

Reconciliation job emits metrics; CloudWatch alarm triggers on non-zero AbsDelta and sends SNS notification to Slack/OneUptime.
C — Nightly self-hosted EC2 runner + GH Actions job
Files to add
terraform/aws/runner_cf.yml (CloudFormation or Terraform script)
scripts/setup-self-hosted-runner.sh — installs Docker, Docker Compose, Node 22, pnpm, GitHub runner agent
.github/workflows/nightly-dfns-integration.yml — nightly job configured to run on self-hosted runner
Runner user-data outline (setup-self-hosted-runner.sh):
#!/usr/bin/env bash
set -e
# install docker
apt-get update && apt-get install -y docker.io docker-compose
# install node 22, pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm i -g pnpm
# install GitHub runner
GITHUB_OWNER="westronet"
GITHUB_REPO="koya"
RUNNER_TOKEN=$(aws secretsmanager get-secret-value --secret-id /koya/gh/runner_token --query SecretString --output text)
mkdir -p /home/ubuntu/actions-runner && cd /home/ubuntu/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.298.2/actions-runner-linux-x64-2.298.2.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/$GITHUB_OWNER/$GITHUB_REPO --token $RUNNER_TOKEN --unattended --labels self-hosted,linux,docker
sudo ./svc.sh install
sudo ./svc.sh start

GitHub Actions job (nightly):

name: nightly/dfns-integration
on:
  schedule: [{cron: '0 3 * * *'}]
  workflow_dispatch:
jobs:
  integration:
    runs-on: [self-hosted, linux, docker]
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with: role-to-assume: "${{ secrets.RUNNER_IAM_ROLE }}"
      - name: Fetch secrets
        run: aws secretsmanager get-secret-value --secret-id /koya/dfns/apiKey --query SecretString --output text > docker/dfns_api_key
      - name: Start integration stack
        run: docker compose -f docker-compose.integration.yml up -d --build
      - name: Wait for services
        run: ./scripts/wait-for-services.sh
      - name: Run integration tests
        run: pnpm nx e2e dfns-integration -- --timeout 1200000
      - name: Upload logs
        uses: actions/upload-artifact@v4
        with: name: integration-logs path: ./tmp/integration-logs
      - name: Tear down
        run: docker compose -f docker-compose.integration.yml down -v

Acceptance

Runner provisions and registers. Nightly job runs and executes integration script.
D — DFNS mTLS rotation script & ECS secret mapping
Files
scripts/rotate-dfns-mtls.sh
scripts/update-ecs-task-secret.sh
scripts/check-cert-expiry.sh
rotate-dfns-mtls.sh (sketch)
#!/usr/bin/env bash
set -euo pipefail
CERT=$1; KEY=$2; CA=$3
# validate pairing
openssl x509 -in "$CERT" -noout -modulus | openssl md5
openssl pkey -in "$KEY" -noout -modulus | openssl md5
# upload to secrets manager
aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/cert --secret-string file://"$CERT"
aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/key --secret-string file://"$KEY"
aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/ca --secret-string file://"$CA"
# trigger ECS update
./scripts/update-ecs-task-secret.sh --service dfns-service --cluster koya-cluster
update-ecs-task-secret.sh (sketch)
Use AWS CLI to fetch current task definition, replace secrets entries for the DFNS entries to reference same secret (Secrets Manager) keys (or add new ones), register new revision, update service to use new revision.
check-cert-expiry.sh
Fetch cert bytes from Secrets Manager, openssl x509 -enddate -noout, compare days left (<14 fail).

Acceptance

Script uploads new certs to Secrets Manager and triggers ECS service redeploy. Cert expiry check fails when <14 days.
E — Circuit breaker + sign-latency alert
Files
apps/api/src/conversion/circuit-breaker.ts — Redis-backed CB class
Modify apps/api/src/conversion/psbt-signing.service.ts to consult CB before calling DFNS and to record failure/success
Circuit-breaker design
Redis keys:
koya:cb:psbt_signing:failures:<window_ts> (sorted set timestamps)
koya:cb:psbt_signing:open_until (timestamp)
Algorithm:
On failure: add timestamp to sorted set, trim to last 10 minutes, if count >=5 set open_until = now + 15m.
On success: if half-open, clear set and open_until.
CB state check: returns CLOSED/OPEN/HALF_OPEN.
psbt-signing.service.ts consults CB: if OPEN, reject new sign attempts and push CloudWatch metric CBOpenCount.
Sign-latency metric & alarm
PsbtSigningService.checkSignPendingLatency() runs every 5 minutes, counts payout_psbts with psbt_status = 'signing_pending' older than 10 minutes, putMetricData as Koya/Signing/SignPendingCount.
Terraform alerts_signing.tf sets Alarm when SignPendingCount > 0.

Acceptance

CB opens after failures, prevents sign attempts, and sign-latency alarm triggers and notifies via SNS.
F — Integration-run script (real DFNS sandbox, no mock) + optional DFNS mock
Files
scripts/run-integration.sh — orchestration script (pull secrets, docker compose up, wait, run tests, teardown)
docker-compose.integration.yml — includes koya-api, redis, bria, bria-pg and references DFNS sandbox by envs (no mock)
Optionally: scripts/dfns-mock/ only used as fallback for local dev: scripts/dfns-mock/server.js + scripts/run-dfns-mock.sh
run-integration.sh (sketch)
Read DFNS secrets from Secrets Manager and write to docker/secrets/ (chmod 600).
docker compose -f docker-compose.integration.yml up -d --build.
Wait for /api/v1/health and DFNS /health.
Trigger conversion scenario: pnpm nx e2e dfns-integration.
On success collect logs: docker logs into tmp/integration-logs and upload to S3 if CI.
Tear down.

DFNS mock (optional): simple Express server with POST /v1/sign-psbt returning base64-signed PSBT (use a test private key to sign PSBT) and POST /v1/webhook/test to replay webhook.

Acceptance

run-integration.sh (using real DFNS sandbox mTLS) completes flow; idempotency replay passes.
G — Runbook expansion (docs)

Update:

docs/deployment/dfns-mtls.md — include Secrets Manager commands and ECS/compose examples, rotation script usage, cert expiry check, troubleshooting mTLS handshake issues.
docs/deployment/reconciliation.md — include SQL queries and triage steps.
docs/deployment/nightly-runner.md — runner provisioning and maintenance.
docs/deployment/psbt-retention.md — restore steps and S3/KMS policy.

Add quick reference: @recorner as on-call. Include playbook for manual reconciliation and circuit-breaker reset.

DFNS research notes (must be integrated)

Agent task: Read DFNS docs at https://docs.dfns.co/api-reference
 and apply the following best practices in code:

Use Idempotency-Key header with externalId. Handle 409 responses by returning existing signed PSBT.
Prefer mTLS for production: perform client cert verification. Provide API-key/JWT fallback for sandbox.
Webhook verification: prefer verifying client mTLS cert for webhooks; if not present, verify HMAC-SHA256 header.
Respect rate limits: implement exponential backoff with jitter and cap retries (default: 5).
Validate signed PSBT: Bria/Koya must verify PSBT signatures locally (if DFNS includes signer metadata, record it). If PSBT invalid, mark as failed and alert.
Secrets & environment variables (examples)
PSBT_ARCHIVE_BUCKET=koya-archives
PSBT_KMS_KEY_ID=arn:aws:kms:us-east-1:...:key/...
DFNS_API_URL=https://app.dfns.io/
DFNS_API_KEY=<PAT> (sandbox fallback)
DFNS_SERVICE_JWT=<JWT>
DFNS_WEBHOOK_SECRET=<string>
DFNS_MTLS_CERT_ARN=/koya/dfns/mTLS/cert
DFNS_MTLS_KEY_ARN=/koya/dfns/mTLS/key
DFNS_MTLS_CA_ARN=/koya/dfns/mTLS/ca
QUICKNODE_RPC_URL=<your quicknode>
SLACK_WEBHOOK_SECRET_ARN=/koya/alerts/slack_webhook
ONEUPTIME_WEBHOOK_SECRET_ARN=/koya/alerts/oneuptime_webhook
RUNNER_IAM_ROLE_ARN=<provided by ops>
Security & operational checklist (must be validated on PR)
Ensure all secrets referenced are in AWS Secrets Manager and accessible by runner/ecs IAM role.
Ensure S3 bucket policy blocks public access; KMS key policy grants only needed roles.
Ensure DFNS mTLS certs are not in Git history — move them to Secrets Manager and remove from repo.
Ensure PSBT archive S3 objects encrypted with KMS.
Ensure CloudWatch SNS topic subscriptions use https endpoints for Slack/OneUptime with secret in headers if supported.
Acceptance criteria (final)
All PR files and scripts added and tested locally or in staging.
Integration run completes with real DFNS sandbox (mTLS) and QuickNode testnet broadcast — conversion becomes COMPLETE.
Idempotency tests pass (duplicate sign request, duplicate webhook).
Retention job archives PSBTs to S3 and marks DB rows.
CloudWatch alarms & SNS notify Slack & OneUptime; @recorner receives alerts.
Circuit Breaker trips/resets per policy and sign-latency alarm triggers.
Nightly job runs on the self-hosted runner; runner provisioning docs included.
Runbook updated.