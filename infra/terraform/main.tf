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

resource "time_offset" "gmt_plus_7" {
  offset_hours = 7
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      CreatedDate = formatdate("DD MMM YYYY hh:mm ZZZ", time_offset.gmt_plus_7.rfc3339)
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
  source           = "./modules/ssm"
  project_name     = var.project_name
  mongodb_username = var.mongodb_username
  mongodb_password = var.mongodb_password
  jwt_secret       = var.jwt_secret
  admin_username   = var.admin_username
  admin_password   = var.admin_password
}

module "iam" {
  source             = "./modules/iam"
  project_name       = var.project_name
  aws_region         = var.aws_region
  ssm_parameter_arns = module.ssm.parameter_arns
  images_bucket_arn  = module.s3.images_bucket_arn
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
  mongodb_host            = var.mongodb_host
  ssm_parameter_arns = {
    mongodb_root_user     = module.ssm.parameter_arns[0]
    mongodb_root_password = module.ssm.parameter_arns[1]
    jwt_secret            = module.ssm.parameter_arns[2]
    admin_username        = module.ssm.parameter_arns[3]
    admin_password        = module.ssm.parameter_arns[4]
  }
}

module "cloudfront" {
  source                               = "./modules/cloudfront"
  project_name                         = var.project_name
  environment                          = var.environment
  frontend_bucket_id                   = module.s3.frontend_bucket_id
  frontend_bucket_arn                  = module.s3.frontend_bucket_arn
  frontend_bucket_regional_domain_name = module.s3.frontend_bucket_regional_domain_name
  images_bucket_id                     = module.s3.images_bucket_id
  images_bucket_arn                    = module.s3.images_bucket_arn
  images_bucket_regional_domain_name   = module.s3.images_bucket_regional_domain_name
  alb_dns_name                         = module.ecs.alb_dns_name
}