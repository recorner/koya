terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — S3 backend
  # Initialized by bootstrap-aws.sh
  backend "s3" {
    key = "foundation/terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "koya"
      Layer       = "foundation"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
