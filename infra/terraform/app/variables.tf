variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "motorshop"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "mongodb_host" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "mongodb_username" {
  description = "MongoDB Atlas username"
  type        = string
  sensitive   = true
}

variable "mongodb_password" {
  description = "MongoDB Atlas password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (>= 32 bytes)"
  type        = string
  sensitive   = true
}

variable "admin_username" {
  description = "Admin login username"
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Admin login password"
  type        = string
  sensitive   = true
}

variable "container_image_tag" {
  description = "Docker image tag for backend deployment"
  type        = string
  default     = "latest"
}

variable "ecr_repository_name" {
  description = "ECR repository name"
  type        = string
}

variable "frontend_s3_bucket_name" {
  description = "S3 bucket name for frontend"
  type        = string
}

variable "images_s3_bucket_name" {
  description = "S3 bucket name for images"
  type        = string
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
}