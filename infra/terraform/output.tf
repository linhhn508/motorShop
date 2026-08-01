output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecr.repository_url
}

output "frontend_bucket_name" {
  description = "S3 bucket for frontend static files"
  value       = module.s3.frontend_bucket_name
}

output "images_bucket_name" {
  description = "S3 bucket for product images"
  value       = module.s3.images_bucket_name
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = module.networking.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = module.networking.ecs_security_group_id
}

output "task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = module.iam.task_execution_role_arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = module.iam.task_role_arn
}

output "alb_dns_name" {
  description = "ALB DNS name — use this to reach the backend"
  value       = module.ecs.alb_dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.ecs.service_name
}

output "task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = module.iam.task_execution_role_arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = module.iam.task_role_arn
}