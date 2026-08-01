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
    key          = "motorshop/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
    encrypt      = true
  }
}

resource "time_static" "creationDate" {}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      CreatedDate = formatdate("DD MMM YYYY hh:mm ZZZ", time_static.creationDate.rfc3339)
    }
  }
}

module "networking" {
  source       = "./modules/networking"
  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  aws_region   = var.aws_region
}

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

module "s3" {
  source       = "./modules/s3"
  project_name = var.project_name
  environment  = var.environment
}

module "ssm" {
  source         = "./modules/ssm"
  project_name   = var.project_name
  mongodb_uri    = var.mongodb_uri
  jwt_secret     = var.jwt_secret
  admin_username = var.admin_username
  admin_password = var.admin_password
}

module "iam" {
  source              = "./modules/iam"
  project_name        = var.project_name
  aws_region          = var.aws_region
  ssm_parameter_arns  = module.ssm.parameter_arns
  images_bucket_arn   = module.s3.images_bucket_arn
}

module "ecs" {
  source                  = "./modules/ecs"
  project_name            = var.project_name
  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  alb_security_group_id   = module.networking.alb_security_group_id
  ecs_security_group_id   = module.networking.ecs_security_group_id
  task_execution_role_arn = module.iam.task_execution_role_arn
  task_role_arn           = module.iam.task_role_arn
  ecr_repository_url      = module.ecr.repository_url
  container_image_tag     = var.container_image_tag
  ssm_parameter_arns = {
    mongodb_uri    = module.ssm.parameter_arns[0]
    jwt_secret     = module.ssm.parameter_arns[1]
    admin_username = module.ssm.parameter_arns[2]
    admin_password = module.ssm.parameter_arns[3]
  }
}
