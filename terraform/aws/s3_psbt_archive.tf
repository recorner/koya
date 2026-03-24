# S3 bucket + KMS key for PSBT archive storage
# Apply: cd terraform/aws && terraform init && terraform apply

variable "environment" {
  type    = string
  default = "production"
}

resource "aws_kms_key" "psbt_archive" {
  description             = "KMS key for PSBT archive encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Service     = "koya"
    Component   = "psbt-archive"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "psbt_archive" {
  name          = "alias/koya-psbt-archive"
  target_key_id = aws_kms_key.psbt_archive.key_id
}

resource "aws_s3_bucket" "psbt_archive" {
  bucket = "koya-archives-${var.environment}"

  tags = {
    Service     = "koya"
    Component   = "psbt-archive"
    Environment = var.environment
  }
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
      days = 730 # 2 years
    }
  }
}

resource "aws_s3_bucket_public_access_block" "psbt_archive" {
  bucket = aws_s3_bucket.psbt_archive.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "psbt_archive_bucket_name" {
  value = aws_s3_bucket.psbt_archive.id
}

output "psbt_archive_kms_key_arn" {
  value = aws_kms_key.psbt_archive.arn
}
