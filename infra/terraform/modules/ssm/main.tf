resource "aws_ssm_parameter" "mongodb_uri" {
  name  = "/${var.project_name}/mongodb-uri"
  type  = "SecureString"
  value = var.mongodb_uri

  tags = {
    Name = "${var.project_name}-mongodb-uri"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project_name}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret

  tags = {
    Name = "${var.project_name}-jwt-secret"
  }
}

resource "aws_ssm_parameter" "admin_username" {
  name  = "/${var.project_name}/admin-username"
  type  = "SecureString"
  value = var.admin_username

  tags = {
    Name = "${var.project_name}-admin-username"
  }
}

resource "aws_ssm_parameter" "admin_password" {
  name  = "/${var.project_name}/admin-password"
  type  = "SecureString"
  value = var.admin_password

  tags = {
    Name = "${var.project_name}-admin-password"
  }
}