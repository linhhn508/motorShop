output "parameter_arns" {
  description = "ARNs of all SSM parameters (for IAM policy)"
  value = [
    aws_ssm_parameter.mongodb_username.arn,
    aws_ssm_parameter.mongodb_password.arn,
    aws_ssm_parameter.jwt_secret.arn,
    aws_ssm_parameter.admin_username.arn,
    aws_ssm_parameter.admin_password.arn,
  ]
}

output "parameter_names" {
  description = "Names of all SSM parameters"
  value = {
    mongodb_username = aws_ssm_parameter.mongodb_username.name
    mongodb_password = aws_ssm_parameter.mongodb_password.name
    jwt_secret       = aws_ssm_parameter.jwt_secret.name
    admin_username   = aws_ssm_parameter.admin_username.name
    admin_password   = aws_ssm_parameter.admin_password.name
  }
}