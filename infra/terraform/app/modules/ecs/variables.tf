variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "task_execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "container_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "mongodb_host" {
  description = "Mongodb Atlas url"
  type        = string
}

variable "ssm_parameter_arns" {
  description = "Map of SSM parameter ARNs for container secrets"
  type = object({
    mongodb_root_password = string
    mongodb_root_user     = string
    jwt_secret            = string
    admin_username        = string
    admin_password        = string
  })
}