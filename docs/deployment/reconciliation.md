# Reconciliation Service — Operations Runbook

Owner: @recorner

## Overview

The `ReconciliationService` runs daily at 03:00 UTC. It compares all confirmed Koya `PayoutInstruction` records against Bria payouts for the last 24 hours, reporting any amount mismatches.

## Metrics Published

| Metric | Namespace | Description |
|--------|-----------|-------------|
| `AbsDelta` | `Koya/Reconciliation` | Absolute total delta in sats across all mismatched payouts |
| `MismatchCount` | `Koya/Reconciliation` | Number of payouts with amount mismatch |

Both metrics include an `Environment` dimension.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLOUDWATCH_METRICS_ENABLED` | Set to any non-empty string to enable CloudWatch publishing | `true` |
| `AWS_REGION` | AWS region for CloudWatch | `us-east-1` |
| `NODE_ENV` | Used as Environment dimension value | `production` |

## Alerting Thresholds

| Alarm | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| `AbsDelta > 0` | Any non-zero delta | WARNING | Investigate mismatch |
| `AbsDelta > 1000` | > 1000 sats | CRITICAL | Immediate escalation to @recorner |
| `MismatchCount > 0` | Any mismatched payout | WARNING | Review payout records |

## Terraform

```bash
cd terraform/aws
terraform apply -var="environment=production" -var="ops_notification_endpoint=https://hooks.slack.com/..."
```

## Triage Steps

### 1. Check reconciliation logs

```bash
# CloudWatch Logs or server logs
grep "ReconciliationService" /var/log/koya-api.log | tail -20
```

### 2. Find mismatched payouts

```sql
SELECT pi.id, pi.external_id, pi.amount_minor, pi.tx_hash, pi.status
FROM payout_instructions pi
WHERE pi.status = 'CONFIRMED'
AND pi.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY pi.updated_at DESC;
```

### 3. Cross-reference with Bria

For each mismatched `external_id`, check Bria:

```bash
# Via Bria CLI or gRPC
grpcurl -d '{"externalId":"<external_id>"}' localhost:2742 bria.v1.BriaService/GetPayout
```

### 4. Check for webhook dedup issues

```sql
SELECT * FROM processed_webhooks
WHERE external_id = '<external_id>'
ORDER BY created_at DESC;
```

### 5. Check PSBT signing state

```sql
SELECT * FROM payout_psbts
WHERE external_id = '<external_id>';
```

### 6. Escalation

If `AbsDelta > 1000`:
1. Page @recorner immediately
2. Gather: mismatch details, Bria payout status, PSBT signing status
3. Check if transaction is on-chain (mempool/blockchain explorer)
4. Determine if funds are at risk or if it's a timing/accounting issue

## IAM Permissions

The Koya API task role needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "cloudwatch:namespace": "Koya/Reconciliation"
    }
  }
}
```
