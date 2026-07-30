# Phase 4: CloudFront + Frontend Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a CloudFront distribution as the single entry point for all traffic — static frontend from S3, product images from S3, and API requests forwarded to the ALB. Deploy frontend files to S3 and update image URLs.

**Architecture:** One CloudFront distribution with three origins: (1) S3 frontend bucket for static files (default behavior), (2) S3 images bucket for `/images/*`, (3) ALB for `/api/*`. The frontend JS is updated to use `/images/` paths instead of `/image/product/` so CloudFront routes image requests to S3.

**Tech Stack:** Terraform >= 1.5, AWS provider 6.55.0, region `ap-southeast-1`, CloudFront, S3, OAC

## Global Constraints

- Region: `ap-southeast-1` (Singapore)
- Budget: under $15/month
- All resources tagged with `Project = "motorshop"` and `Environment = "production"`
- Remote state: S3 bucket `motorshop-terraform-state-126637980632`, native S3 locking
- `.tfvars` files are gitignored — secrets never in git
- Terraform commands are run on personal PC, not this workspace
- Frontend image refs currently use `/image/product/<id>/thumbnail.png`
- S3 images bucket stores files as `<product-id>/thumbnail.png` (no `product/` prefix)

---

## File Structure

```
infra/terraform/
├── main.tf                          # Add cloudfront module call
├── variables.tf                     # (no changes needed)
├── output.tf                        # Add cloudfront outputs
│
├── modules/
│   └── cloudfront/
│       ├── main.tf                  # Distribution, OAC, S3 policies, cache behaviors
│       ├── variables.tf
│       └── outputs.tf

frontend/
├── js/
│   ├── main.js                      # Update image URLs
│   └── product_info.js              # Update image URLs
```

---

### Task 1: CloudFront Terraform Module

**Files:**
- Create: `infra/terraform/modules/cloudfront/main.tf`
- Create: `infra/terraform/modules/cloudfront/variables.tf`
- Create: `infra/terraform/modules/cloudfront/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `environment`, `frontend_bucket_id`, `frontend_bucket_arn`, `frontend_bucket_regional_domain_name`, `images_bucket_id`, `images_bucket_arn`, `images_bucket_regional_domain_name`, `alb_dns_name`
- Produces: `distribution_id`, `distribution_domain_name`

- [ ] **Step 1: Create modules/cloudfront/variables.tf**

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "frontend_bucket_id" {
  type = string
}

variable "frontend_bucket_arn" {
  type = string
}

variable "frontend_bucket_regional_domain_name" {
  type = string
}

variable "images_bucket_id" {
  type = string
}

variable "images_bucket_arn" {
  type = string
}

variable "images_bucket_regional_domain_name" {
  type = string
}

variable "alb_dns_name" {
  type = string
}
```

- [ ] **Step 2: Create modules/cloudfront/main.tf**

```hcl
# --- Origin Access Control for S3 ---
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "images" {
  name                              = "${var.project_name}-images-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# --- CloudFront Distribution ---
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name} distribution"
  price_class         = "PriceClass_200"

  # Origin 1: Frontend S3 bucket (default)
  origin {
    domain_name              = var.frontend_bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: Images S3 bucket
  origin {
    domain_name              = var.images_bucket_regional_domain_name
    origin_id                = "images-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.images.id
  }

  # Origin 3: ALB (backend API)
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behavior: frontend static files from S3
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
    compress    = true
  }

  # /images/* -> images S3 bucket
  ordered_cache_behavior {
    path_pattern           = "/images/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "images-s3"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
    compress    = true
  }

  # /api/* -> ALB (no caching)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-backend"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Authorization", "Content-Type"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Custom error pages: serve index.html for SPA-style routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-distribution"
  }
}

# --- S3 Bucket Policies for CloudFront OAC ---
resource "aws_s3_bucket_policy" "frontend" {
  bucket = var.frontend_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${var.frontend_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_policy" "images" {
  bucket = var.images_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${var.images_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}
```

- [ ] **Step 3: Create modules/cloudfront/outputs.tf**

```hcl
output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/cloudfront/
git commit -m "infra: add CloudFront module (distribution with S3 + ALB origins)"
```

---

### Task 2: Wire CloudFront Module + Add S3 Outputs for OAC

The CloudFront module needs `bucket_regional_domain_name` and `bucket_id` from the S3 module, and `alb_dns_name` from the ECS module (Phase 3). The S3 module currently outputs bucket names and ARNs but not domain names or IDs needed by CloudFront OAC.

**Files:**
- Modify: `infra/terraform/modules/s3/outputs.tf` — add `regional_domain_name` and bucket `id` outputs
- Modify: `infra/terraform/main.tf` — add cloudfront module call
- Modify: `infra/terraform/output.tf` — add cloudfront outputs

**Interfaces:**
- Consumes: S3 module outputs (extended), ECS module `alb_dns_name`
- Produces: Updated root config with cloudfront module wired in

- [ ] **Step 1: Add missing outputs to S3 module**

Append to `infra/terraform/modules/s3/output.tf`:

```hcl
output "frontend_bucket_id" {
  value = aws_s3_bucket.frontend.id
}

output "frontend_bucket_regional_domain_name" {
  value = aws_s3_bucket.frontend.bucket_regional_domain_name
}

output "images_bucket_id" {
  value = aws_s3_bucket.images.id
}

output "images_bucket_regional_domain_name" {
  value = aws_s3_bucket.images.bucket_regional_domain_name
}
```

- [ ] **Step 2: Add cloudfront module call to root main.tf**

Append after the `module "ecs"` block in `infra/terraform/main.tf`:

```hcl
module "cloudfront" {
  source                               = "./modules/cloudfront"
  project_name                         = var.project_name
  environment                          = var.environment
  frontend_bucket_id                   = module.s3.frontend_bucket_id
  frontend_bucket_arn                  = module.s3.frontend_bucket_arn
  frontend_bucket_regional_domain_name = module.s3.frontend_bucket_regional_domain_name
  images_bucket_id                     = module.s3.images_bucket_id
  images_bucket_arn                    = module.s3.images_bucket_arn
  images_bucket_regional_domain_name   = module.s3.images_bucket_regional_domain_name
  alb_dns_name                         = module.ecs.alb_dns_name
}
```

- [ ] **Step 3: Add cloudfront outputs to root output.tf**

Append to `infra/terraform/output.tf`:

```hcl
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name — the app URL"
  value       = module.cloudfront.distribution_domain_name
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/s3/output.tf infra/terraform/main.tf infra/terraform/output.tf
git commit -m "infra: wire CloudFront module into root config"
```

---

### Task 3: Update Frontend Image URLs

**Files:**
- Modify: `frontend/js/main.js`
- Modify: `frontend/js/product_info.js`

**Interfaces:**
- Consumes: CloudFront `/images/*` path pattern → S3 images bucket
- Produces: Frontend that works with CloudFront image routing

The current image URL pattern is `/image/product/<id>/thumbnail.png`. CloudFront routes `/images/*` to the S3 images bucket. The images in S3 are stored as `<product-id>/thumbnail.png`. So the new URL pattern should be `/images/<id>/thumbnail.png`.

- [ ] **Step 1: Update main.js image URL**

In `frontend/js/main.js`, change:
```js
<img src="/image/product/${product.id}/thumbnail.png" alt="${product.name}">
```
to:
```js
<img src="/images/${product.id}/thumbnail.png" alt="${product.name}">
```

- [ ] **Step 2: Update product_info.js image URL**

In `frontend/js/product_info.js`, change:
```js
<img src="/image/product/${productInfo.id}/thumbnail.png" alt="${productInfo.name}">
```
to:
```js
<img src="/images/${productInfo.id}/thumbnail.png" alt="${productInfo.name}">
```

- [ ] **Step 3: Commit**

```bash
cd /home/hoi9hc/motorShop
git add frontend/js/main.js frontend/js/product_info.js
git commit -m "feat: update frontend image URLs for CloudFront S3 routing"
```

---

### Task 4: Terraform Plan and Apply (CloudFront)

**Files:** None — Terraform CLI only

- [ ] **Step 1: Initialize Terraform**

```bash
cd /home/hoi9hc/motorShop/infra/terraform
terraform init
```

- [ ] **Step 2: Plan**

```bash
terraform plan
```

Expected: Shows creation of CloudFront distribution, OAC resources, S3 bucket policies. ~5-7 new resources.

- [ ] **Step 3: Apply**

```bash
terraform apply
```

Expected: CloudFront distribution created. Note the `cloudfront_domain_name` output — this is the app URL.

Note: CloudFront distributions take 5-15 minutes to deploy.

- [ ] **Step 4: Verify CloudFront domain name**

```bash
terraform output cloudfront_domain_name
```

---

### Task 5: Deploy Frontend to S3

**Files:** None — CLI only

- [ ] **Step 1: Get frontend bucket name**

```bash
cd /home/hoi9hc/motorShop/infra/terraform
terraform output frontend_bucket_name
```

- [ ] **Step 2: Sync frontend files to S3**

```bash
cd /home/hoi9hc/motorShop
aws s3 sync frontend/ s3://<FRONTEND_BUCKET_NAME>/ --region ap-southeast-1 --delete
```

Expected: All frontend files uploaded (HTML, CSS, JS, assets).

- [ ] **Step 3: Invalidate CloudFront cache**

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

- [ ] **Step 4: Verify the app**

Open `https://<CLOUDFRONT_DOMAIN_NAME>` in a browser.

Expected:
- Homepage loads with product listing
- Product images load from `/images/<id>/thumbnail.png`
- Clicking a product shows the product detail page with image
- `/api/health` returns `{"status": "healthy"}`

---

## Verification Checklist

```bash
# Frontend loads
curl -I https://<CLOUDFRONT_DOMAIN_NAME>/
# Expected: HTTP 200

# Product images load
curl -I https://<CLOUDFRONT_DOMAIN_NAME>/images/<product-id>/thumbnail.png
# Expected: HTTP 200

# API routes work through CloudFront
curl https://<CLOUDFRONT_DOMAIN_NAME>/api/health
# Expected: {"status": "healthy"}

curl https://<CLOUDFRONT_DOMAIN_NAME>/api/products/
# Expected: Product list JSON
```

**Milestone:** Full app accessible via CloudFront URL — frontend from S3, images from S3, API from ALB/ECS.
