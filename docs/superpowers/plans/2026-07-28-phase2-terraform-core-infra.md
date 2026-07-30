# Phase 2: Terraform Core Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the core AWS infrastructure using Terraform — VPC, subnets, security groups, ECR, S3 buckets, SSM parameters, and IAM roles. No application deployment yet — just the foundation.

**Architecture:** Modular Terraform layout under `infra/terraform/` with remote state in S3 + DynamoDB. ECS tasks will run in public subnets with `assign_public_ip = true` (no NAT Gateway to save cost). VPC endpoints for ECR, S3, and CloudWatch Logs.

**Tech Stack:** Terraform >= 1.5, AWS provider >= 5.0, region `ap-southeast-1`

## Global Constraints

- Region: `ap-southeast-1` (Singapore)
- Budget: under $15/month — no NAT Gateway, no DocumentDB
- Remote state: S3 bucket + DynamoDB table (bootstrapped separately)
- All resources tagged with `Project = "motorshop"` and `Environment = "production"`
- Terraform state bucket and DynamoDB table are bootstrapped manually (one-time)
- `.tfvars` files are gitignored — secrets never in git
- Module structure: one module per concern (networking, ecr, s3, ssm, iam)

---

## File Structure

```
infra/terraform/
├── main.tf                          # Provider, backend config, module calls
├── variables.tf                     # Root input variables
├── outputs.tf                       # Root outputs (VPC ID, subnet IDs, ECR URL, etc.)
├── terraform.tfvars                 # Variable values (GITIGNORED)
├── terraform.tfvars.example         # Template for tfvars
│
├── bootstrap/
│   ├── main.tf                      # S3 bucket + DynamoDB table for remote state
│   ├── variables.tf
│   └── outputs.tf
│
├── modules/
│   ├── networking/
│   │   ├── main.tf                  # VPC, subnets, IGW, route tables, security groups
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ecr/
│   │   ├── main.tf                  # ECR repository
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── s3/
│   │   ├── main.tf                  # Frontend bucket + images bucket
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── ssm/
│       ├── main.tf                  # SSM Parameter Store entries (placeholders)
│       ├── variables.tf
│       └── outputs.tf
```

---

### Task 1: Install Prerequisites (Terraform + AWS CLI)

**Files:** None — system setup only

**Interfaces:**
- Consumes: nothing
- Produces: `terraform` and `aws` CLI available in PATH

- [ ] **Step 1: Install Terraform**

```bash
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update && sudo apt-get install -y terraform
```

- [ ] **Step 2: Verify Terraform**

```bash
terraform version
```
Expected: `Terraform v1.x.x`

- [ ] **Step 3: Install AWS CLI v2**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
```

- [ ] **Step 4: Verify AWS CLI**

```bash
aws --version
```
Expected: `aws-cli/2.x.x ...`

- [ ] **Step 5: Configure AWS credentials**

```bash
aws configure
```
Enter: AWS Access Key ID, Secret Access Key, region `ap-southeast-1`, output `json`.

- [ ] **Step 6: Verify AWS access**

```bash
aws sts get-caller-identity
```
Expected: returns your AWS account ID and ARN.

---

### Task 2: Bootstrap Remote State

**Files:**
- Create: `infra/terraform/bootstrap/main.tf`
- Create: `infra/terraform/bootstrap/variables.tf`
- Create: `infra/terraform/bootstrap/outputs.tf`

**Interfaces:**
- Consumes: AWS credentials from Task 1
- Produces: S3 bucket `motorshop-terraform-state-<account_id>` and DynamoDB table `motorshop-terraform-lock`

- [ ] **Step 1: Create bootstrap directory**

```bash
mkdir -p infra/terraform/bootstrap
```

- [ ] **Step 2: Create bootstrap/variables.tf**

```hcl
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
```

- [ ] **Step 3: Create bootstrap/main.tf**

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = var.project_name
    Environment = "production"
    Purpose     = "Terraform state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project_name}-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Project     = var.project_name
    Environment = "production"
    Purpose     = "Terraform state lock"
  }
}
```

- [ ] **Step 4: Create bootstrap/outputs.tf**

```hcl
output "state_bucket_name" {
  description = "S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_lock.name
}

output "state_bucket_arn" {
  description = "ARN of the state bucket"
  value       = aws_s3_bucket.terraform_state.arn
}
```

- [ ] **Step 5: Initialize and apply bootstrap**

```bash
cd infra/terraform/bootstrap
terraform init
terraform plan
terraform apply
```

Expected: S3 bucket and DynamoDB table created. Note the bucket name from output — you'll need it for the backend config.

- [ ] **Step 6: Commit bootstrap**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/bootstrap/
git commit -m "infra: bootstrap terraform remote state (S3 + DynamoDB)"
```

---

### Task 3: Root Terraform Configuration

**Files:**
- Create: `infra/terraform/main.tf`
- Create: `infra/terraform/variables.tf`
- Create: `infra/terraform/outputs.tf`
- Create: `infra/terraform/terraform.tfvars.example`
- Update: `.gitignore`

**Interfaces:**
- Consumes: S3 bucket name and DynamoDB table name from Task 2
- Produces: Root Terraform config that calls all modules, with remote state backend

- [ ] **Step 1: Create infra/terraform/variables.tf**

```hcl
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

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
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
```

- [ ] **Step 2: Create infra/terraform/main.tf**

Replace `<YOUR_STATE_BUCKET>` with the actual bucket name from Task 2 output.

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket         = "<YOUR_STATE_BUCKET>"
    key            = "motorshop/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "motorshop-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
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
```

- [ ] **Step 3: Create infra/terraform/outputs.tf**

```hcl
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
```

- [ ] **Step 4: Create infra/terraform/terraform.tfvars.example**

```hcl
aws_region     = "ap-southeast-1"
project_name   = "motorshop"
environment    = "production"
vpc_cidr       = "10.0.0.0/16"
mongodb_uri    = "mongodb+srv://user:pass@cluster.mongodb.net/my_web_app"
jwt_secret     = "your-secret-key-at-least-32-bytes-long!!"
admin_username = "admin"
admin_password = "your-admin-password"
```

- [ ] **Step 5: Add terraform files to .gitignore**

Append to `.gitignore`:

```
# Terraform
infra/terraform/.terraform/
infra/terraform/*.tfstate
infra/terraform/*.tfstate.backup
infra/terraform/*.tfvars
infra/terraform/bootstrap/.terraform/
infra/terraform/bootstrap/*.tfstate
infra/terraform/bootstrap/*.tfstate.backup
```

- [ ] **Step 6: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/main.tf infra/terraform/variables.tf infra/terraform/outputs.tf infra/terraform/terraform.tfvars.example .gitignore
git commit -m "infra: add root terraform configuration with remote state backend"
```

---

### Task 4: Networking Module (VPC, Subnets, Security Groups)

**Files:**
- Create: `infra/terraform/modules/networking/main.tf`
- Create: `infra/terraform/modules/networking/variables.tf`
- Create: `infra/terraform/modules/networking/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `environment`, `vpc_cidr`, `aws_region`
- Produces: `vpc_id`, `public_subnet_ids` (list of 2), `alb_security_group_id`, `ecs_security_group_id`

- [ ] **Step 1: Create modules/networking/variables.tf**

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "aws_region" {
  type = string
}
```

- [ ] **Step 2: Create modules/networking/main.tf**

```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

# --- VPC ---
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# --- Internet Gateway ---
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# --- Public Subnets (2 AZs for ALB requirement) ---
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index}"
  }
}

# --- Route Table ---
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Security Group: ALB ---
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP/HTTPS inbound to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# --- Security Group: ECS Tasks ---
resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg"
  description = "Allow inbound from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From ALB"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg"
  }
}
```

- [ ] **Step 3: Create modules/networking/outputs.tf**

```hcl
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/networking/
git commit -m "infra: add networking module (VPC, subnets, security groups)"
```

---

### Task 5: ECR Module

**Files:**
- Create: `infra/terraform/modules/ecr/main.tf`
- Create: `infra/terraform/modules/ecr/variables.tf`
- Create: `infra/terraform/modules/ecr/outputs.tf`

**Interfaces:**
- Consumes: `project_name`
- Produces: `repository_url`, `repository_arn`

- [ ] **Step 1: Create modules/ecr/variables.tf**

```hcl
variable "project_name" {
  type = string
}
```

- [ ] **Step 2: Create modules/ecr/main.tf**

```hcl
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
```

- [ ] **Step 3: Create modules/ecr/outputs.tf**

```hcl
output "repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "repository_arn" {
  value = aws_ecr_repository.backend.arn
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/ecr/
git commit -m "infra: add ECR module with lifecycle policy"
```

---

### Task 6: S3 Module (Frontend + Images Buckets)

**Files:**
- Create: `infra/terraform/modules/s3/main.tf`
- Create: `infra/terraform/modules/s3/variables.tf`
- Create: `infra/terraform/modules/s3/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `environment`
- Produces: `frontend_bucket_name`, `frontend_bucket_arn`, `images_bucket_name`, `images_bucket_arn`

- [ ] **Step 1: Create modules/s3/variables.tf**

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}
```

- [ ] **Step 2: Create modules/s3/main.tf**

```hcl
data "aws_caller_identity" "current" {}

# --- Frontend Static Site Bucket ---
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "${var.project_name}-frontend"
    Purpose = "Frontend static files"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- Product Images Bucket ---
resource "aws_s3_bucket" "images" {
  bucket = "${var.project_name}-images-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "${var.project_name}-images"
    Purpose = "Product images"
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

Note: Both buckets block public access — they will be served through CloudFront with Origin Access Control (Phase 4).

- [ ] **Step 3: Create modules/s3/outputs.tf**

```hcl
output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  value = aws_s3_bucket.frontend.arn
}

output "images_bucket_name" {
  value = aws_s3_bucket.images.id
}

output "images_bucket_arn" {
  value = aws_s3_bucket.images.arn
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/s3/
git commit -m "infra: add S3 module (frontend + images buckets)"
```

---

### Task 7: SSM Parameter Store Module

**Files:**
- Create: `infra/terraform/modules/ssm/main.tf`
- Create: `infra/terraform/modules/ssm/variables.tf`
- Create: `infra/terraform/modules/ssm/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `mongodb_uri`, `jwt_secret`, `admin_username`, `admin_password`
- Produces: SSM parameter ARNs for ECS task role policy (Phase 3)

- [ ] **Step 1: Create modules/ssm/variables.tf**

```hcl
variable "project_name" {
  type = string
}

variable "mongodb_uri" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "admin_username" {
  type      = string
  sensitive = true
}

variable "admin_password" {
  type      = string
  sensitive = true
}
```

- [ ] **Step 2: Create modules/ssm/main.tf**

```hcl
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
```

- [ ] **Step 3: Create modules/ssm/outputs.tf**

```hcl
output "parameter_arns" {
  description = "ARNs of all SSM parameters (for IAM policy)"
  value = [
    aws_ssm_parameter.mongodb_uri.arn,
    aws_ssm_parameter.jwt_secret.arn,
    aws_ssm_parameter.admin_username.arn,
    aws_ssm_parameter.admin_password.arn,
  ]
}

output "parameter_names" {
  description = "Names of all SSM parameters"
  value = {
    mongodb_uri    = aws_ssm_parameter.mongodb_uri.name
    jwt_secret     = aws_ssm_parameter.jwt_secret.name
    admin_username = aws_ssm_parameter.admin_username.name
    admin_password = aws_ssm_parameter.admin_password.name
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/ssm/
git commit -m "infra: add SSM Parameter Store module"
```

---

### Task 8: Terraform Init, Plan, and Apply

**Files:** None — execution only

**Interfaces:**
- Consumes: all modules from Tasks 3-7, AWS credentials from Task 1
- Produces: all AWS resources created

- [ ] **Step 1: Create terraform.tfvars**

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with real values
```

For `mongodb_uri`, use a placeholder for now — we'll set up MongoDB Atlas in Phase 3. Use: `mongodb+srv://placeholder:placeholder@placeholder.mongodb.net/my_web_app`

- [ ] **Step 2: Initialize Terraform**

```bash
cd infra/terraform
terraform init
```

Expected: backend initialized with S3, all modules downloaded.

- [ ] **Step 3: Validate**

```bash
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 4: Plan**

```bash
terraform plan
```

Expected: shows ~15-20 resources to create (VPC, subnets, IGW, route tables, security groups, ECR repo, 2 S3 buckets, 4 SSM parameters).

- [ ] **Step 5: Apply**

```bash
terraform apply
```

Type `yes` when prompted. Expected: all resources created successfully.

- [ ] **Step 6: Verify outputs**

```bash
terraform output
```

Expected: VPC ID, subnet IDs, ECR URL, bucket names, security group IDs.

- [ ] **Step 7: Verify resources in AWS**

```bash
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=motorshop" --query 'Vpcs[0].VpcId' --output text
aws ecr describe-repositories --repository-names motorshop-backend --query 'repositories[0].repositoryUri' --output text
aws s3 ls | grep motorshop
aws ssm get-parameters-by-path --path /motorshop/ --query 'Parameters[*].Name' --output text
```

Expected: all resources exist and match Terraform outputs.

- [ ] **Step 8: Format check**

```bash
cd infra/terraform
terraform fmt -recursive -check
```

Expected: no formatting issues. If there are, run `terraform fmt -recursive` and commit.

- [ ] **Step 9: Final commit**

```bash
cd /home/hoi9hc/motorShop
git add -A infra/terraform/
git commit -m "infra: terraform init, validate, and apply — core infrastructure provisioned"
```
