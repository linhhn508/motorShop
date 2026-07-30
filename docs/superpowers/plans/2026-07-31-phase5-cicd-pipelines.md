# Phase 5: CI/CD Pipelines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up three GitHub Actions pipelines: backend (lint → test → build → push ECR → deploy ECS), frontend (sync S3 → invalidate CloudFront), and terraform (fmt → plan → manual approve → apply).

**Architecture:** All pipelines trigger on push to `main`. Backend pipeline only runs on changes to `backend/`. Frontend pipeline only runs on changes to `frontend/`. Terraform pipeline only runs on changes to `infra/terraform/`. Feature branches run lint + test only (no deploy). PRs show terraform plan but don't apply.

**Tech Stack:** GitHub Actions, AWS ECR, ECS, S3, CloudFront, Terraform

## Global Constraints

- Region: `ap-southeast-1` (Singapore)
- All secrets stored in GitHub Actions secrets (never in code)
- ECR repository: `motorshop-backend`
- ECS cluster: `motorshop-cluster`
- ECS service: `motorshop-backend`
- Frontend bucket and CloudFront distribution ID from terraform outputs
- Terraform state: S3 bucket `motorshop-terraform-state-126637980632`
- Backend uses `uv` package manager, Python 3.12, `ruff` for linting, `pytest` for testing
- Required GitHub Actions secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

---

## File Structure

```
.github/
└── workflows/
    ├── backend.yml              # Backend pipeline: lint → test → build → push → deploy
    ├── frontend.yml             # Frontend pipeline: sync S3 → invalidate CloudFront
    └── terraform.yml            # Terraform pipeline: fmt → plan → approve → apply
```

---

### Task 1: Backend CI/CD Pipeline

**Files:**
- Create: `.github/workflows/backend.yml`

**Interfaces:**
- Consumes: GitHub secrets for AWS credentials
- Produces: Automated backend deployment on push to `main`

- [ ] **Step 1: Create .github/workflows/backend.yml**

```yaml
name: Backend CI/CD

on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

env:
  AWS_REGION: ap-southeast-1
  ECR_REPOSITORY: motorshop-backend
  ECS_CLUSTER: motorshop-cluster
  ECS_SERVICE: motorshop-backend

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.12

      - name: Install dependencies
        working-directory: backend
        run: uv sync

      - name: Run ruff
        working-directory: backend
        run: uv run ruff check .

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    services:
      mongodb:
        image: mongo:7
        env:
          MONGO_INITDB_ROOT_USERNAME: testuser
          MONGO_INITDB_ROOT_PASSWORD: testpass
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.runCommand({ping:1})' --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      MONGODB_HOST: localhost
      MONGO_INITDB_ROOT_USERNAME: testuser
      MONGO_INITDB_ROOT_PASSWORD: testpass
      JWT_SECRET: test-secret-key-at-least-32-bytes-long!!
      ADMIN_USERNAME: testadmin
      ADMIN_PASSWORD: testpassword
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.12

      - name: Install dependencies
        working-directory: backend
        run: uv sync

      - name: Run tests
        working-directory: backend
        run: uv run pytest tests/ -v

  build-and-deploy:
    name: Build & Deploy
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            -f infra/Dockerfile/service/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment \
            --region $AWS_REGION
```

- [ ] **Step 2: Commit**

```bash
cd /home/hoi9hc/motorShop
git add .github/workflows/backend.yml
git commit -m "ci: add backend pipeline (lint, test, build, push ECR, deploy ECS)"
```

---

### Task 2: Frontend CI/CD Pipeline

**Files:**
- Create: `.github/workflows/frontend.yml`

**Interfaces:**
- Consumes: GitHub secrets for AWS credentials, terraform outputs for bucket name and distribution ID
- Produces: Automated frontend deployment on push to `main`

- [ ] **Step 1: Create .github/workflows/frontend.yml**

```yaml
name: Frontend CI/CD

on:
  push:
    branches: [main]
    paths: ['frontend/**']
  pull_request:
    branches: [main]
    paths: ['frontend/**']

env:
  AWS_REGION: ap-southeast-1

jobs:
  deploy:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: |
          aws s3 sync frontend/ s3://${{ secrets.FRONTEND_BUCKET_NAME }}/ \
            --region $AWS_REGION \
            --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

- [ ] **Step 2: Commit**

```bash
cd /home/hoi9hc/motorShop
git add .github/workflows/frontend.yml
git commit -m "ci: add frontend pipeline (S3 sync + CloudFront invalidation)"
```

---

### Task 3: Terraform CI/CD Pipeline

**Files:**
- Create: `.github/workflows/terraform.yml`

**Interfaces:**
- Consumes: GitHub secrets for AWS credentials, terraform vars as secrets
- Produces: Automated terraform plan on PRs, manual-approve apply on push to `main`

- [ ] **Step 1: Create .github/workflows/terraform.yml**

```yaml
name: Terraform CI/CD

on:
  push:
    branches: [main]
    paths: ['infra/terraform/**']
  pull_request:
    branches: [main]
    paths: ['infra/terraform/**']

env:
  AWS_REGION: ap-southeast-1
  TF_WORKING_DIR: infra/terraform

jobs:
  format:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ">=1.5"

      - name: Terraform Format Check
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform fmt -check -recursive

  plan:
    name: Plan
    runs-on: ubuntu-latest
    needs: format
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ">=1.5"

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform init

      - name: Terraform Plan
        working-directory: ${{ env.TF_WORKING_DIR }}
        env:
          TF_VAR_mongodb_uri: ${{ secrets.MONGODB_URI }}
          TF_VAR_jwt_secret: ${{ secrets.JWT_SECRET }}
          TF_VAR_admin_username: ${{ secrets.ADMIN_USERNAME }}
          TF_VAR_admin_password: ${{ secrets.ADMIN_PASSWORD }}
        run: terraform plan -no-color

  apply:
    name: Apply
    runs-on: ubuntu-latest
    needs: plan
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ">=1.5"

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform init

      - name: Terraform Apply
        working-directory: ${{ env.TF_WORKING_DIR }}
        env:
          TF_VAR_mongodb_uri: ${{ secrets.MONGODB_URI }}
          TF_VAR_jwt_secret: ${{ secrets.JWT_SECRET }}
          TF_VAR_admin_username: ${{ secrets.ADMIN_USERNAME }}
          TF_VAR_admin_password: ${{ secrets.ADMIN_PASSWORD }}
        run: terraform apply -auto-approve
```

- [ ] **Step 2: Commit**

```bash
cd /home/hoi9hc/motorShop
git add .github/workflows/terraform.yml
git commit -m "ci: add terraform pipeline (fmt, plan, manual-approve apply)"
```

---

### Task 4: Configure GitHub Secrets and Environment

**Files:** None — GitHub UI only

- [ ] **Step 1: Create GitHub repository secrets**

Go to the repository Settings → Secrets and variables → Actions, and add:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `AWS_ACCOUNT_ID` | `126637980632` |
| `FRONTEND_BUCKET_NAME` | From `terraform output frontend_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From `terraform output cloudfront_distribution_id` |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Your JWT secret |
| `ADMIN_USERNAME` | Your admin username |
| `ADMIN_PASSWORD` | Your admin password |

- [ ] **Step 2: Create GitHub Environment for manual approval**

Go to Settings → Environments → New environment:
- Name: `production`
- Add protection rule: Required reviewers (add yourself)

This ensures `terraform apply` requires manual approval before running.

- [ ] **Step 3: Test by pushing a small backend change**

Make a trivial change to `backend/` (e.g., add a comment) and push to a feature branch, then merge to `main`. Verify the backend pipeline runs: lint → test → build → push → deploy.

---

## Verification Checklist

- [ ] Backend pipeline triggers on push to `main` with changes in `backend/`
- [ ] Backend pipeline runs lint → test only on PRs (no deploy)
- [ ] Frontend pipeline syncs to S3 and invalidates CloudFront on push to `main`
- [ ] Terraform pipeline shows plan on PRs, requires approval before apply on `main`
- [ ] All secrets are configured in GitHub repository settings

**Milestone:** Push to `main` auto-deploys everything — backend to ECS, frontend to S3/CloudFront, infrastructure via Terraform.
