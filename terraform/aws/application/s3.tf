# ── S3 PSBT Archive ──────────────────────────────────────────────

resource "aws_kms_key" "psbt_archive" {
  description             = "KMS key for PSBT archive encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = { Component = "psbt-archive" }
}

resource "aws_kms_alias" "psbt_archive" {
  name          = "alias/${var.project}-psbt-archive-${var.environment}"
  target_key_id = aws_kms_key.psbt_archive.key_id
}

resource "aws_s3_bucket" "psbt_archive" {
  bucket = "${var.project}-archives-${var.environment}"
  tags   = { Component = "psbt-archive" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "psbt_archive" {
  bucket = aws_s3_bucket.psbt_archive.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.psbt_archive.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "psbt_archive" {
  bucket = aws_s3_bucket.psbt_archive.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "psbt_archive" {
  bucket = aws_s3_bucket.psbt_archive.id

  rule {
    id     = "archive-retention"
    status = "Enabled"

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 730
    }
  }
}

resource "aws_s3_bucket_public_access_block" "psbt_archive" {
  bucket                  = aws_s3_bucket.psbt_archive.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
