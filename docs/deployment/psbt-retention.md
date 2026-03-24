# PSBT Retention & S3 Archival

Owner: @recorner

## Overview

The `PsbtRetentionService` runs daily at 02:00 UTC. It archives PSBT data older than 90 days from the `payout_psbts` table to S3, then clears the blob data from the database (replaced with `[archived]` marker).

## Flow

```
┌──────────────────────────────────┐
│    PsbtRetentionService (cron)   │
│    02:00 UTC daily               │
│                                  │
│  1. Query settled/failed >90d    │
│  2. Compress (gzip) PSBT data   │
│  3. Upload to S3 (KMS-encrypted)│
│  4. Mark DB: psbtBase64='[archived]'│
│  5. Clear signedPsbtBase64       │
└──────────────────────────────────┘
```

## S3 Path Convention

```
s3://koya-archives-{env}/payout_psbts/{year}/{month}/{externalId}.psbt.gz
```

Example: `s3://koya-archives-production/payout_psbts/2025/06/koya:conversion:abc123.psbt.gz`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PSBT_ARCHIVE_S3_BUCKET` | S3 bucket name | `koya-archives-production` |
| `PSBT_ARCHIVE_KMS_KEY_ID` | KMS key ARN for encryption | `arn:aws:kms:us-east-1:123:key/abc` |
| `AWS_REGION` | AWS region | `us-east-1` |

If `PSBT_ARCHIVE_S3_BUCKET` is not set, the service still archives by marking DB rows but does not upload to S3.

## Terraform

Apply the S3 bucket + KMS key:

```bash
cd terraform/aws
terraform init
terraform apply -var="environment=production"
```

This creates:
- S3 bucket `koya-archives-{env}` with KMS encryption, versioning, and lifecycle rules
- KMS key with automatic rotation enabled
- Public access block on the bucket

## IAM Permissions

The Koya API task role needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject"
  ],
  "Resource": "arn:aws:s3:::koya-archives-*/*"
},
{
  "Effect": "Allow",
  "Action": [
    "kms:Encrypt",
    "kms:Decrypt",
    "kms:GenerateDataKey"
  ],
  "Resource": "<KMS_KEY_ARN>"
}
```

## Restore Playbook

To restore an archived PSBT for audit or investigation:

### 1. Download from S3

```bash
aws s3 cp s3://koya-archives-production/payout_psbts/2025/06/koya:conversion:abc123.psbt.gz ./restored.psbt.gz
```

### 2. Decompress

```bash
gunzip restored.psbt.gz
cat restored.psbt
# JSON: { externalId, psbtBase64, signedPsbtBase64, archivedAt }
```

### 3. Re-insert to DB (if needed)

```sql
UPDATE payout_psbts
SET psbt_base64 = '<psbtBase64 from JSON>',
    signed_psbt_base64 = '<signedPsbtBase64 from JSON>',
    psbt_status = 'settled'
WHERE external_id = 'koya:conversion:abc123';
```

## Monitoring

- The service logs S3 upload paths and errors
- Failed uploads are logged as errors and the PSBT is **not** marked as archived (data preserved)
- Monitor CloudWatch Logs for `PsbtRetentionService` error entries

## Troubleshooting

### S3 upload fails — AccessDenied
1. Check the API task role has `s3:PutObject` on the bucket
2. Check the KMS key policy allows the task role to use `kms:GenerateDataKey`
3. Verify bucket name matches `PSBT_ARCHIVE_S3_BUCKET` env var

### No PSBTs being archived
1. Check `payout_psbts` table has rows with `psbt_status IN ('settled', 'failed')` and `updated_at < NOW() - INTERVAL '90 days'`
2. Check cron is enabled (NestJS `@nestjs/schedule` is imported in `AppModule`)
3. Check service logs for `No PSBTs eligible for archival`
