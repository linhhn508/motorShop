output "vpc_id" {
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "alb_security_group_id" {
  value = module.networking.alb_security_group_id
}

output "ecs_security_group_id" {
  value = module.networking.alb_security_group_id
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecr_repository_arn" {
  value = module.ecr.repository_arn
}