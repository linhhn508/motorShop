variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "ssm_parameter_arns" {
  description = "ARNs of SSM parameters the task needs to read"
  type        = list(string)
}

variable "images_bucket_arn" {
  description = "ARN of the S3 images bucket"
  type        = string
}