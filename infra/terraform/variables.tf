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

# variable "mongodb_uri" {
#   description = "MongoDB Atlas connection string"
#   type        = string
#   sensitive   = true
# }

# variable "jwt_secret" {
#   description = "JWT signing secret (>= 32 bytes)"
#   type        = string
#   sensitive   = true
# }

# variable "admin_username" {
#   description = "Admin login username"
#   type        = string
#   sensitive   = true
# }

# variable "admin_password" {
#   description = "Admin login password"
#   type        = string
#   sensitive   = true
# }