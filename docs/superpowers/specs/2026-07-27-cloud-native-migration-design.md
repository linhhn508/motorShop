# Cloud-Native Migration — Design Spec

**Date:** 2026-07-27
**Project:** motorShop — Motorcycle Parts E-Shop
**Goal:** Migrate the existing Docker Compose app to AWS with full CI/CD, Terraform IaC, and expanded backend features. Primary purpose is learning DevOps practices with real-world patterns.

**Constraints:**
- Budget: under $15/month on AWS
- CI/CD: GitHub Actions
- IaC: Terraform
- Database: MongoDB Atlas Free Tier (replacing local MongoDB)
- No framework migration on frontend (stays vanilla HTML/JS/CSS)

---

## 1. Architecture Overview

A single **CloudFront distribution** serves as the entry point for all traffic:
- `/api/*` routes to an **ALB** → **ECS Fargate** (Flask backend)
- `/images/*` routes to an **S3 bucket** (product images, replacing MinIO)
- Everything else routes to an **S3 bucket** (frontend static files, replacing Nginx)

The backend runs in **ECS Fargate** (0.25 vCPU, 0.5GB RAM) in public subnets with security groups restricting access to ALB-only. No NAT Gateway (saves ~$32/month) — instead, VPC endpoints for ECR/S3/CloudWatch and `assign_public_ip = true` on ECS tasks.

Secrets (MongoDB URI, JWT secret, SES config) are stored in **SSM Parameter Store** and injected into ECS tasks via IAM task role permissions.

**MongoDB Atlas Free Tier** (512MB) replaces DocumentDB (which starts at ~$50/month). Atlas is set up manually; the connection string goes into SSM.

### Architecture Diagram

```
Users → CloudFront → S3 (frontend static files)
                   → S3 (product images)
                   → ALB → ECS Fargate (Flask backend)
                                ↓
                           MongoDB Atlas
                           SSM Parameter Store
                           SES (email)
                           CloudWatch (logs/metrics)
```

---

## 2. CI/CD Pipelines

Three GitHub Actions pipelines, all triggered on push to `main`:

### Backend Pipeline (on changes to `backend/`)
1. **Lint** — `ruff` for Python linting
2. **Test** — `pytest` (unit + integration tests)
3. **Build** — `docker build` the Flask app
4. **Push** — Push image to ECR with commit SHA tag + `latest`
5. **Deploy** — Update ECS service to pull the new image (rolling deployment)

### Frontend Pipeline (on changes to `frontend/`)
1. **Sync** — `aws s3 sync` frontend files to S3
2. **Invalidate** — Invalidate CloudFront cache

### Terraform Pipeline (on changes to `infra/terraform/`)
1. **Format check** — `terraform fmt -check`
2. **Plan** — `terraform plan` (output shown in PR)
3. **Manual approval** — GitHub Environments protection rule
4. **Apply** — `terraform apply`

### Branch Strategy
- **`main`** — triggers full pipeline (lint → test → build → deploy)
- **Feature branches** — run lint + test only (no deploy)
- **PRs to `main`** — Terraform shows plan but does not apply

---

## 3. Terraform Infrastructure Layout

```
infra/terraform/
├── main.tf                  # Provider config
├── variables.tf             # Input variables
├── outputs.tf               # Outputs (URLs, ARNs)
├── terraform.tfvars         # Variable values (gitignored)
├── backend.tf               # S3 remote state config
│
├── modules/
│   ├── networking/          # VPC, subnets, security groups, VPC endpoints
│   ├── ecr/                 # Container registry
│   ├── ecs/                 # Cluster, task definition, service, ALB, IAM roles
│   ├── s3/                  # Frontend bucket + images bucket
│   ├── cloudfront/          # Distribution with S3 + ALB origins
│   ├── monitoring/          # CloudWatch log groups, alarms, SNS, dashboard
│   └── ses/                 # SES email identity + verification
```

### Remote State
- S3 bucket for state file + DynamoDB table for state locking
- Bootstrapped manually (one-time setup script)

### Cost-Saving Decisions
- No NAT Gateway — VPC endpoints + public subnets with security groups
- SSM Parameter Store Standard tier (free) instead of Secrets Manager ($0.40/secret/month)
- MongoDB Atlas Free Tier instead of DocumentDB
- Single small Fargate task (0.25 vCPU, 0.5GB RAM)

---

## 4. Backend Expansion

### Existing Routes (already implemented)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products/` | List all products |
| GET | `/api/products/<id>/info` | Get single product details |
| GET | `/api/products/categories/` | List product categories |
| POST | `/api/products/add/` | Add product (stub — needs implementation) |
| PUT | `/api/products/update/` | Update product (stub — needs implementation) |
| DELETE | `/api/products/remove/` | Delete product (stub — needs implementation) |

### New Routes
| Method | Route | Description | AWS Service |
|--------|-------|-------------|-------------|
| GET | `/api/products/search?q=` | Search products by name/category | MongoDB text index |
| POST | `/api/contact` | Submit contact form | SES (sends email) |
| POST | `/api/feedback` | Submit feedback with star rating | MongoDB (new collection) |
| GET | `/api/health` | ALB health check | — |
| POST | `/api/auth/login` | Admin login, returns JWT | SSM (reads credentials) |

### Authentication (JWT)
- `PyJWT` library — lightweight, educational (no full auth framework)
- Single admin user — credentials in SSM Parameter Store
- `@token_required` decorator protects write endpoints: `add`, `update`, `remove`
- Public routes (all GET endpoints, contact, feedback) stay unauthenticated
- Short-lived JWTs, no refresh tokens
- JWT secret stored in SSM Parameter Store

### Other Backend Changes
- **Implement CRUD stubs** — `add`, `update`, `remove` endpoints need actual MongoDB operations
- **Structured JSON logging** — replace plain text logs with JSON formatter for CloudWatch Logs Insights compatibility
- **Configuration from environment/SSM** — all secrets and config via environment variables (injected by ECS from SSM)
- **Input validation** — server-side validation for contact form, feedback, and CRUD operations
- **`ruff`** — add as dev dependency for linting

### Testing
- **Unit tests** with `pytest` — mock MongoDB and SES, test each route
- **Integration tests** — test against a real MongoDB instance (using test containers or mongomock)
- Tests must pass in CI before deployment is allowed

---

## 5. Frontend Changes

Minimal changes — the frontend already uses relative `/api/` paths.

### Changes Needed
1. **Image URLs** — update product thumbnail references from MinIO URLs to CloudFront/S3 paths
2. **Contact form** — add JS to submit via `fetch()` to `POST /api/contact`, show success/error feedback
3. **Feedback form** — add JS to submit star rating + comment to `POST /api/feedback`
4. **Search bar** — wire existing search UI to `GET /api/products/search?q=...`, display results

### Not In Scope
- No framework migration (stays vanilla HTML/JS/CSS)
- No new pages
- No cart/checkout
- No admin panel UI

---

## 6. Monitoring & Observability

### CloudWatch
| Component | Purpose | Cost |
|-----------|---------|------|
| Log Groups | ECS task logs (Flask stdout/stderr) | Free tier (5GB) |
| Container Insights | CPU/memory metrics for ECS | Free (basic) |
| Alarms (4) | Alert on failures | Free tier (10 alarms) |
| Dashboard (1) | Single-pane health view | Free (3 dashboards) |

### Alarms
1. **ECS task unhealthy** — task restarting or failing health checks
2. **High CPU** — Fargate task CPU > 80% sustained
3. **5xx error rate** — ALB returning server errors
4. **High response time** — ALB target response time > 2 seconds

### Notifications
- Alarms trigger **SNS** → email notification

### Not In Scope
- No X-Ray tracing
- No custom metrics
- No Grafana/Prometheus

---

## 7. Implementation Phases

Each phase delivers something working and testable.

### Phase 1: Foundation (Tests + Backend Expansion)
- Write tests for existing routes
- Implement CRUD stubs (add, update, remove products)
- Add search, contact (SES), feedback, health check endpoints
- Add JWT authentication for write endpoints
- Add structured JSON logging
- Set up `ruff` for linting
- **Milestone:** Expanded, tested backend running locally with Docker Compose

### Phase 2: Terraform Core Infrastructure
- Bootstrap remote state (S3 bucket + DynamoDB lock table)
- VPC, subnets, security groups, VPC endpoints
- ECR repository
- S3 buckets (frontend + images)
- SSM Parameter Store entries
- **Milestone:** AWS infrastructure provisioned, nothing deployed yet

### Phase 3: ECS + ALB Deployment
- ECS cluster, task definition, service
- ALB + target group + health check
- IAM roles (task execution role, task role with SSM/SES/S3 read)
- MongoDB Atlas free cluster (manual setup, connection string → SSM)
- Migrate product images to S3
- **Milestone:** Backend running on AWS, reachable via ALB

### Phase 4: CloudFront + Frontend Deployment
- CloudFront distribution with S3 + ALB origins
- Deploy frontend static files to S3
- Update frontend image URLs for CloudFront
- **Milestone:** Full app accessible via CloudFront URL

### Phase 5: CI/CD Pipelines
- Backend pipeline: lint → test → build → push ECR → deploy ECS
- Frontend pipeline: sync S3 → invalidate CloudFront
- Terraform pipeline: fmt → plan → manual approve → apply
- **Milestone:** Push to `main` auto-deploys everything

### Phase 6: Monitoring
- CloudWatch log groups + Container Insights
- 4 alarms (unhealthy task, 5xx, high CPU, slow responses)
- SNS email notifications
- CloudWatch dashboard
- **Milestone:** Full observability with alerting

---

## 8. AWS Services Summary

| # | Service | Purpose | Cost |
|---|---------|---------|------|
| 1 | ECR | Docker image registry | ~$0.50/month |
| 2 | ECS Fargate | Run Flask backend | ~$7.50/month |
| 3 | ALB | Load balancer + routing | ~$3.50/month |
| 4 | S3 | Frontend hosting + product images + Terraform state | ~$0.10/month |
| 5 | CloudFront | CDN + HTTPS + routing | ~$0.50/month |
| 6 | VPC | Networking (subnets, security groups) | Free |
| 7 | IAM | Roles and policies | Free |
| 8 | SSM Parameter Store | Secrets management | Free |
| 9 | SES | Contact form email | Free tier |
| 10 | CloudWatch | Logs, metrics, alarms, dashboard | Free tier |
| 11 | SNS | Alarm notifications | Free tier |
| 12 | DynamoDB | Terraform state lock | Free tier |
| 13 | MongoDB Atlas | Database (external) | Free tier |
| **Total** | | | **~$12-13/month** |

---

## 9. Local Development

Docker Compose remains the local development environment. The existing `docker-compose.yml` continues to work for local dev — MongoDB and MinIO containers simulate Atlas and S3 locally. No changes to the local dev workflow except adding new environment variables for new features.

**SES in local dev:** SES is mocked locally — contact form emails are logged to console instead of sent. Real email sending only happens on AWS. The backend checks an environment variable (e.g., `FLASK_ENV=development`) to decide whether to call SES or log.

**VPC endpoints clarification:** ECS Fargate tasks in public subnets with `assign_public_ip = true` can reach external services (MongoDB Atlas, SES API) via the internet directly. VPC endpoints are specifically for AWS services (ECR, S3, CloudWatch Logs) to keep that traffic private and avoid data transfer costs — not strictly required, but a best practice worth learning.
