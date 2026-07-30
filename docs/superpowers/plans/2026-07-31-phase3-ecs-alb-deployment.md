# Phase 3: ECS + ALB Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Flask backend to ECS Fargate behind an ALB, with IAM roles for SSM/S3/SES access, and migrate product images from MinIO to the S3 images bucket.

**Architecture:** ECS Fargate runs the backend container (0.25 vCPU, 0.5GB RAM) in public subnets with `assign_public_ip = true`. An ALB in public subnets forwards `/api/*` traffic to the ECS service. IAM task role grants SSM read, S3 read, SES send, and CloudWatch Logs write. The Dockerfile is updated to work with MongoDB Atlas (connection string from SSM) instead of local MongoDB.

**Tech Stack:** Terraform >= 1.5, AWS provider 6.55.0, region `ap-southeast-1`, ECS Fargate, ALB, IAM, S3

## Global Constraints

- Region: `ap-southeast-1` (Singapore)
- Budget: under $15/month — no NAT Gateway, single small Fargate task
- All resources tagged with `Project = "motorshop"` and `Environment = "production"`
- Remote state: S3 bucket `motorshop-terraform-state-126637980632`, native S3 locking
- `.tfvars` files are gitignored — secrets never in git
- Module structure: one module per concern
- Terraform commands are run on personal PC, not this workspace
- Backend container port: `5000`
- Health check endpoint: `GET /api/health` → `{"status": "healthy"}`
- SSM parameters: `/motorshop/mongodb-uri`, `/motorshop/jwt-secret`, `/motorshop/admin-username`, `/motorshop/admin-password`

---

## File Structure

```
infra/terraform/
├── main.tf                          # Add ecs module call + iam module call
├── variables.tf                     # Add new variables (ses_sender_email, etc.)
├── outputs.tf                       # Add ALB DNS, ECS cluster/service outputs
│
├── modules/
│   ├── iam/
│   │   ├── main.tf                  # Task execution role, task role, policies
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── ecs/
│       ├── main.tf                  # Cluster, task def, service, ALB, target group, listeners
│       ├── variables.tf
│       └── outputs.tf

infra/Dockerfile/
└── service/
    └── Dockerfile                   # Update for MongoDB Atlas compatibility
```

---

### Task 1: IAM Module (Task Execution Role + Task Role)

**Files:**
- Create: `infra/terraform/modules/iam/main.tf`
- Create: `infra/terraform/modules/iam/variables.tf`
- Create: `infra/terraform/modules/iam/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `ssm_parameter_arns` (list from SSM module), `images_bucket_arn` (from S3 module), `aws_region`, `account_id`
- Produces: `task_execution_role_arn`, `task_role_arn`

- [ ] **Step 1: Create modules/iam/variables.tf**

```hcl
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
```

- [ ] **Step 2: Create modules/iam/main.tf**

```hcl
# --- ECS Task Execution Role ---
# Used by ECS agent to pull images from ECR, write logs, and read SSM parameters

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow task execution role to read SSM parameters (for container secrets injection)
resource "aws_iam_role_policy" "ecs_task_execution_ssm" {
  name = "${var.project_name}-ecs-exec-ssm"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameters"
        Resource = var.ssm_parameter_arns
      }
    ]
  })
}

# --- ECS Task Role ---
# Used by the running container to access AWS services at runtime

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task"
  }
}

# Task role policy: S3 read (images), SES send, CloudWatch Logs
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${var.project_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.images_bucket_arn,
          "${var.images_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "noreply@*"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${var.project_name}-backend:*"
      }
    ]
  })
}
```

- [ ] **Step 3: Create modules/iam/outputs.tf**

```hcl
output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/iam/
git commit -m "infra: add IAM module (ECS task execution + task roles)"
```

---

### Task 2: ECS Module (Cluster, Task Definition, Service, ALB)

**Files:**
- Create: `infra/terraform/modules/ecs/main.tf`
- Create: `infra/terraform/modules/ecs/variables.tf`
- Create: `infra/terraform/modules/ecs/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `environment`, `aws_region`, `vpc_id`, `public_subnet_ids`, `alb_security_group_id`, `ecs_security_group_id`, `task_execution_role_arn`, `task_role_arn`, `ecr_repository_url`, `container_image_tag`, `ssm_parameter_names` (map with mongodb_uri, jwt_secret, admin_username, admin_password)
- Produces: `alb_dns_name`, `cluster_name`, `service_name`, `alb_arn`, `target_group_arn`

- [ ] **Step 1: Create modules/ecs/variables.tf**

```hcl
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

variable "ssm_parameter_arns" {
  description = "Map of SSM parameter ARNs for container secrets"
  type = object({
    mongodb_uri    = string
    jwt_secret     = string
    admin_username = string
    admin_password = string
  })
}
```

- [ ] **Step 2: Create modules/ecs/main.tf**

```hcl
# --- CloudWatch Log Group ---
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-backend-logs"
  }
}

# --- ECS Cluster ---
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# --- Task Definition ---
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-backend"
      image     = "${var.ecr_repository_url}:${var.container_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = 5000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "FLASK_APP"
          value = "app"
        },
        {
          name  = "FLASK_ENV"
          value = var.environment
        }
      ]

      secrets = [
        {
          name      = "MONGO_URI"
          valueFrom = var.ssm_parameter_arns.mongodb_uri
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.ssm_parameter_arns.jwt_secret
        },
        {
          name      = "ADMIN_USERNAME"
          valueFrom = var.ssm_parameter_arns.admin_username
        },
        {
          name      = "ADMIN_PASSWORD"
          valueFrom = var.ssm_parameter_arns.admin_password
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-backend"
  }
}

# --- ALB ---
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# --- Target Group ---
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-backend-tg"
  }
}

# --- ALB Listener (HTTP) ---
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# --- ECS Service ---
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "${var.project_name}-backend"
    container_port   = 5000
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${var.project_name}-backend"
  }
}
```

- [ ] **Step 3: Create modules/ecs/outputs.tf**

```hcl
output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (for Route53/CloudFront)"
  value       = aws_lb.main.zone_id
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "target_group_arn" {
  description = "ALB target group ARN"
  value       = aws_lb_target_group.backend.arn
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.backend.name
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/ecs/
git commit -m "infra: add ECS module (cluster, task def, service, ALB)"
```

---

### Task 3: Wire IAM + ECS Modules into Root Config

**Files:**
- Modify: `infra/terraform/main.tf`
- Modify: `infra/terraform/variables.tf`
- Modify: `infra/terraform/output.tf`

**Interfaces:**
- Consumes: outputs from networking, ecr, s3, ssm modules (already wired)
- Produces: updated root outputs including `alb_dns_name`, `cluster_name`, `service_name`

- [ ] **Step 1: Add `container_image_tag` variable to root variables.tf**

Append to the existing `infra/terraform/variables.tf`:

```hcl
variable "container_image_tag" {
  description = "Docker image tag for backend deployment"
  type        = string
  default     = "latest"
}
```

- [ ] **Step 2: Add IAM and ECS module calls to root main.tf**

Append after the existing `module "ssm"` block in `infra/terraform/main.tf`:

```hcl
module "iam" {
  source              = "./modules/iam"
  project_name        = var.project_name
  aws_region          = var.aws_region
  ssm_parameter_arns  = module.ssm.parameter_arns
  images_bucket_arn   = module.s3.images_bucket_arn
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
  ssm_parameter_arns = {
    mongodb_uri    = module.ssm.parameter_arns[0]
    jwt_secret     = module.ssm.parameter_arns[1]
    admin_username = module.ssm.parameter_arns[2]
    admin_password = module.ssm.parameter_arns[3]
  }
}
```

- [ ] **Step 3: Add new outputs to root output.tf**

Append to the existing `infra/terraform/output.tf`:

```hcl
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
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/main.tf infra/terraform/variables.tf infra/terraform/output.tf
git commit -m "infra: wire IAM + ECS modules into root terraform config"
```

---

### Task 4: Update Backend Dockerfile for AWS Deployment

**Files:**
- Modify: `infra/Dockerfile/service/Dockerfile`

**Interfaces:**
- Consumes: ECS task definition injects env vars `MONGO_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FLASK_ENV`
- Produces: Docker image compatible with both local (docker-compose) and AWS (ECS) deployment

The current Dockerfile uses `MONGODB_HOST` and expects `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` as separate env vars. For Atlas, a single `MONGO_URI` connection string is used. The backend `__init__.py` needs to support both patterns.

- [ ] **Step 1: Update the Dockerfile**

Replace `infra/Dockerfile/service/Dockerfile` with:

```dockerfile
FROM python:3.12-slim

ENV FLASK_APP=app

WORKDIR /web-service

RUN pip install uv

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync

COPY backend/app ./app

EXPOSE 5000

CMD ["uv", "run", "--", "gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
```

- [ ] **Step 2: Update backend `__init__.py` to support both local and Atlas MongoDB**

Modify `backend/app/__init__.py` — update the `MONGO_URI` config section to check for a `MONGO_URI` env var first (Atlas/AWS), and fall back to building it from individual env vars (local docker-compose):

```python
import os

from flask import Flask, jsonify, request
from flask_pymongo import PyMongo

mongo = PyMongo()


def create_app():
    from app.logging_config import setup_logging

    setup_logging()

    app = Flask(__name__)

    # Support both Atlas (single MONGO_URI) and local Docker (individual vars)
    if os.environ.get("MONGO_URI"):
        app.config["MONGO_URI"] = os.environ["MONGO_URI"]
    else:
        app.config["MONGO_URI"] = (
            f"mongodb://{os.environ['MONGO_INITDB_ROOT_USERNAME']}:{os.environ['MONGO_INITDB_ROOT_PASSWORD']}@{os.environ['MONGODB_HOST']}/my_web_app?authSource=admin"
        )

    app.config["JWT_SECRET"] = os.environ["JWT_SECRET"]
    app.config["ADMIN_USERNAME"] = os.environ["ADMIN_USERNAME"]
    app.config["ADMIN_PASSWORD"] = os.environ["ADMIN_PASSWORD"]

    # CORS enable here, enabling cross-origin requests for all routes and origins
    # CORS(app)

    # Initialize Flask extensions here
    mongo.init_app(app)

    # Register blueprints here

    from app.main import bp as main_bp

    app.register_blueprint(main_bp)

    from app.products import bp as products_bp

    app.register_blueprint(products_bp, url_prefix="/api/products")

    from app.health import bp as health_bp

    app.register_blueprint(health_bp, url_prefix="/api/health")

    from app.auth import bp as auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from app.contact import bp as contact_bp

    app.register_blueprint(contact_bp, url_prefix="/api/contact")

    from app.feedback import bp as feedback_bp

    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")

    @app.route("/test/")
    def test_page():
        return "<h1>Testing the Flask Application Factory Pattern</h1>"

    @app.errorhandler(404)
    def not_found_error(error):
        if request.accept_mimetypes.best_match(["text/html", "application/json"]) == "application/json":
            return jsonify({"error": "Not found"}), 404

        return "<h1>404 Not Found</h1>", 404

    return app
```

- [ ] **Step 3: Verify existing tests still pass locally**

```bash
cd /home/hoi9hc/motorShop/backend
source .venv/bin/activate
uv run pytest tests/ -v
```

Expected: All existing tests pass (they use docker-compose style env vars via conftest.py fixtures).

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/Dockerfile/service/Dockerfile backend/app/__init__.py
git commit -m "feat: support both Atlas and local MongoDB connection patterns"
```

---

### Task 5: Build and Push Docker Image to ECR

**Files:** None — CLI commands only

**Interfaces:**
- Consumes: ECR repository URL from `terraform output ecr_repository_url`
- Produces: Docker image in ECR tagged with `latest`

- [ ] **Step 1: Get ECR repository URL**

```bash
cd /home/hoi9hc/motorShop/infra/terraform
terraform output ecr_repository_url
```

Note the output — it will look like `126637980632.dkr.ecr.ap-southeast-1.amazonaws.com/motorshop-backend`.

- [ ] **Step 2: Authenticate Docker with ECR**

```bash
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 126637980632.dkr.ecr.ap-southeast-1.amazonaws.com
```

Expected: `Login Succeeded`

- [ ] **Step 3: Build the Docker image**

```bash
cd /home/hoi9hc/motorShop
docker build -t motorshop-backend -f infra/Dockerfile/service/Dockerfile .
```

Expected: Build succeeds.

- [ ] **Step 4: Tag and push to ECR**

```bash
docker tag motorshop-backend:latest 126637980632.dkr.ecr.ap-southeast-1.amazonaws.com/motorshop-backend:latest
docker push 126637980632.dkr.ecr.ap-southeast-1.amazonaws.com/motorshop-backend:latest
```

Expected: Image pushed successfully.

- [ ] **Step 5: Verify image in ECR**

```bash
aws ecr describe-images --repository-name motorshop-backend --region ap-southeast-1
```

Expected: Shows the image with `latest` tag.

---

### Task 6: Terraform Plan and Apply (ECS + IAM)

**Files:** None — Terraform CLI only

**Interfaces:**
- Consumes: All modules wired in Task 3
- Produces: Running ECS cluster, service, ALB, IAM roles on AWS

- [ ] **Step 1: Initialize Terraform (pick up new modules)**

```bash
cd /home/hoi9hc/motorShop/infra/terraform
terraform init
```

Expected: Initializes successfully, downloads any new provider plugins.

- [ ] **Step 2: Terraform plan**

```bash
terraform plan
```

Expected: Shows creation of IAM roles, ECS cluster, task definition, service, ALB, target group, listener, CloudWatch log group. Should be ~12-15 new resources.

- [ ] **Step 3: Terraform apply**

```bash
terraform apply
```

Expected: All resources created. Note the `alb_dns_name` output — this is the URL to reach the backend.

- [ ] **Step 4: Verify ALB is accessible**

```bash
curl http://<ALB_DNS_NAME>/api/health
```

Expected: `{"status": "healthy"}` with HTTP 200.

Note: The ECS service may take 2-3 minutes to stabilize. If health check fails initially, wait and retry. Check ECS service events in the AWS Console if issues persist.

- [ ] **Step 5: Verify API routes**

```bash
curl http://<ALB_DNS_NAME>/api/products/
```

Expected: Returns product list from MongoDB Atlas.

- [ ] **Step 6: Commit any adjustments**

If any tweaks were needed during apply, commit them:

```bash
cd /home/hoi9hc/motorShop
git add -A
git commit -m "infra: deploy ECS + IAM, backend running on AWS"
```

---

### Task 7: Migrate Product Images to S3

**Files:** None — CLI commands only

**Interfaces:**
- Consumes: S3 images bucket name from `terraform output images_bucket_name`, product images from `infra/Dockerfile/minio/product/`
- Produces: Product images uploaded to S3 with same path structure as MinIO

The current MinIO structure is:
```
product-image/
  gac-chan-nhom-biker/thumbnail.png
  guong-gu-tay-lai-crg/thumbnail.png
  heo-dau-brembo-4-pis/thumbnail.png
  lop-michelin-city-grip-2/thumbnail.png
  nhong-sen-dia-did-vang-428hd/thumbnail.png
  phuoc-sau-ohlins-binh-dau/thumbnail.png
  po-akrapovic-r1/thumbnail.png
  xi-nhan-led-koso/thumbnail.png
  yen-doi-triump-speed-400/thumbnail.png
```

The frontend references images as `/image/product/<id>/thumbnail.png`. In the AWS architecture, CloudFront (Phase 4) will map `/images/*` to this S3 bucket. For now, we just need the images in S3.

- [ ] **Step 1: Get the images bucket name**

```bash
cd /home/hoi9hc/motorShop/infra/terraform
terraform output images_bucket_name
```

- [ ] **Step 2: Upload images to S3**

```bash
cd /home/hoi9hc/motorShop
aws s3 sync infra/Dockerfile/minio/product/ s3://<IMAGES_BUCKET_NAME>/ --region ap-southeast-1
```

Expected: 9 thumbnail.png files uploaded.

- [ ] **Step 3: Verify images in S3**

```bash
aws s3 ls s3://<IMAGES_BUCKET_NAME>/ --recursive
```

Expected: Lists all 9 product directories with their thumbnail.png files.

---

### Task 8: MongoDB Atlas Setup (Manual)

**Files:** None — AWS Console / MongoDB Atlas UI only

**Interfaces:**
- Consumes: Nothing (manual setup)
- Produces: MongoDB Atlas connection string stored in SSM parameter `/motorshop/mongodb-uri`

This task is done manually through the MongoDB Atlas UI and AWS Console.

- [ ] **Step 1: Create MongoDB Atlas Free Tier Cluster**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free M0 cluster in `ap-southeast-1` (Singapore)
3. Create a database user with read/write access
4. Add `0.0.0.0/0` to the IP access list (ECS tasks have dynamic IPs in public subnets)
5. Get the connection string — it looks like: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/my_web_app?retryWrites=true&w=majority`

- [ ] **Step 2: Seed the database**

Use `mongoimport` or the Atlas UI to import the product data from `infra/Dockerfile/mongodb/products.json`:

```bash
mongoimport --uri "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/my_web_app" --collection products --file infra/Dockerfile/mongodb/products.json --jsonArray
```

- [ ] **Step 3: Update SSM parameter with Atlas connection string**

```bash
aws ssm put-parameter \
  --name "/motorshop/mongodb-uri" \
  --type "SecureString" \
  --value "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/my_web_app?retryWrites=true&w=majority" \
  --overwrite \
  --region ap-southeast-1
```

- [ ] **Step 4: Force ECS service to pick up new SSM value**

```bash
aws ecs update-service \
  --cluster motorshop-cluster \
  --service motorshop-backend \
  --force-new-deployment \
  --region ap-southeast-1
```

Expected: New task starts with the Atlas connection string. Wait 2-3 minutes, then test:

```bash
curl http://<ALB_DNS_NAME>/api/products/
```

Expected: Returns products from MongoDB Atlas.

---

## Verification Checklist

After all tasks are complete, verify these endpoints work:

```bash
# Health check
curl http://<ALB_DNS_NAME>/api/health
# Expected: {"status": "healthy"}

# Product listing
curl http://<ALB_DNS_NAME>/api/products/
# Expected: JSON array of products

# Product categories
curl http://<ALB_DNS_NAME>/api/products/categories/
# Expected: JSON array of categories

# Search
curl "http://<ALB_DNS_NAME>/api/products/search?q=michelin"
# Expected: Matching products

# Auth login
curl -X POST http://<ALB_DNS_NAME>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "<admin_user>", "password": "<admin_pass>"}'
# Expected: {"token": "..."}
```

**Milestone:** Backend running on AWS ECS Fargate, reachable via ALB, connected to MongoDB Atlas, product images in S3.
