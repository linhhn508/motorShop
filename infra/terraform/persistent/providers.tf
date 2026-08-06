terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.55.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "= 0.14.0"
    }
  }

  backend "s3" {
    bucket       = "motorshop-terraform-state-126637980632"
    key          = "persistent/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  }
}