terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    key = "application/terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "koya"
      Layer       = "application"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ── Remote State: Foundation + Platform ──────────────────────────

data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket = var.tf_state_bucket
    key    = "foundation/terraform.tfstate"
    region = var.aws_region
  }
}

data "terraform_remote_state" "platform" {
  backend = "s3"

  config = {
    bucket = var.tf_state_bucket
    key    = "platform/terraform.tfstate"
    region = var.aws_region
  }
}
