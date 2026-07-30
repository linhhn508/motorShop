# Phase 6: Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up CloudWatch monitoring with log groups, 4 alarms (unhealthy task, high CPU, 5xx errors, slow responses), SNS email notifications, and a CloudWatch dashboard.

**Architecture:** CloudWatch Logs already receives ECS task logs (configured in Phase 3 task definition). This phase adds alarms on ALB and ECS metrics, an SNS topic for email alerts, and a dashboard for single-pane observability.

**Tech Stack:** Terraform >= 1.5, AWS provider 6.55.0, region `ap-southeast-1`, CloudWatch, SNS

## Global Constraints

- Region: `ap-southeast-1` (Singapore)
- Budget: under $15/month — stay within free tier (10 alarms, 3 dashboards, 5GB logs)
- All resources tagged with `Project = "motorshop"` and `Environment = "production"`
- Remote state: S3 bucket `motorshop-terraform-state-126637980632`, native S3 locking
- Terraform commands are run on personal PC, not this workspace
- ECS cluster: `motorshop-cluster`
- ECS service: `motorshop-backend`
- ALB: `motorshop-alb`
- Log group: `/ecs/motorshop-backend` (already created in Phase 3)

---

## File Structure

```
infra/terraform/
├── main.tf                          # Add monitoring module call
├── variables.tf                     # Add alarm_email variable
├── output.tf                        # Add monitoring outputs
│
├── modules/
│   └── monitoring/
│       ├── main.tf                  # SNS topic, 4 alarms, dashboard
│       ├── variables.tf
│       └── outputs.tf
```

---

### Task 1: Monitoring Terraform Module

**Files:**
- Create: `infra/terraform/modules/monitoring/main.tf`
- Create: `infra/terraform/modules/monitoring/variables.tf`
- Create: `infra/terraform/modules/monitoring/outputs.tf`

**Interfaces:**
- Consumes: `project_name`, `environment`, `aws_region`, `alarm_email`, `ecs_cluster_name`, `ecs_service_name`, `alb_arn_suffix`, `target_group_arn_suffix`
- Produces: `sns_topic_arn`, `dashboard_name`

- [ ] **Step 1: Create modules/monitoring/variables.tf**

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

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_name" {
  type = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics (app/name/id)"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch metrics"
  type        = string
}
```

- [ ] **Step 2: Create modules/monitoring/main.tf**

```hcl
# --- SNS Topic for Alarms ---
resource "aws_sns_topic" "alarms" {
  name = "${var.project_name}-alarms"

  tags = {
    Name = "${var.project_name}-alarms"
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# --- Alarm 1: ECS Task Unhealthy ---
resource "aws_cloudwatch_metric_alarm" "ecs_unhealthy" {
  alarm_name          = "${var.project_name}-ecs-unhealthy"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "ECS task is unhealthy or not running"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-ecs-unhealthy"
  }
}

# --- Alarm 2: High CPU ---
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS task CPU utilization above 80%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = {
    Name = "${var.project_name}-high-cpu"
  }
}

# --- Alarm 3: 5xx Error Rate ---
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB target returning 5xx errors"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-alb-5xx"
  }
}

# --- Alarm 4: High Response Time ---
resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.project_name}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 2
  alarm_description   = "ALB target response time above 2 seconds"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-high-latency"
  }
}

# --- CloudWatch Dashboard ---
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ECS CPU & Memory"
          region  = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ALB Request Count"
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "ALB Response Time"
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "Average" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p99" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "ALB Error Rates"
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }],
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Minimum" }]
          ]
          period = 300
        }
      }
    ]
  })
}
```

- [ ] **Step 3: Create modules/monitoring/outputs.tf**

```hcl
output "sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  value       = aws_sns_topic.alarms.arn
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/monitoring/
git commit -m "infra: add monitoring module (SNS, 4 alarms, dashboard)"
```

---

### Task 2: Add ECS Module Outputs for Monitoring

The monitoring module needs ALB and target group ARN suffixes. The ECS module (Phase 3) needs to export these.

**Files:**
- Modify: `infra/terraform/modules/ecs/outputs.tf`

**Interfaces:**
- Produces: `alb_arn_suffix`, `target_group_arn_suffix`

- [ ] **Step 1: Add ARN suffix outputs to ECS module**

Append to `infra/terraform/modules/ecs/outputs.tf`:

```hcl
output "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics"
  value       = aws_lb.main.arn_suffix
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch metrics"
  value       = aws_lb_target_group.backend.arn_suffix
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/modules/ecs/outputs.tf
git commit -m "infra: add ALB/TG ARN suffix outputs to ECS module"
```

---

### Task 3: Wire Monitoring Module into Root Config

**Files:**
- Modify: `infra/terraform/main.tf`
- Modify: `infra/terraform/variables.tf`
- Modify: `infra/terraform/output.tf`

**Interfaces:**
- Consumes: ECS module outputs (cluster_name, service_name, alb_arn_suffix, target_group_arn_suffix)
- Produces: Updated root config with monitoring module

- [ ] **Step 1: Add alarm_email variable to root variables.tf**

Append to `infra/terraform/variables.tf`:

```hcl
variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
}
```

- [ ] **Step 2: Add monitoring module call to root main.tf**

Append after the `module "cloudfront"` block in `infra/terraform/main.tf`:

```hcl
module "monitoring" {
  source                  = "./modules/monitoring"
  project_name            = var.project_name
  environment             = var.environment
  aws_region              = var.aws_region
  alarm_email             = var.alarm_email
  ecs_cluster_name        = module.ecs.cluster_name
  ecs_service_name        = module.ecs.service_name
  alb_arn_suffix          = module.ecs.alb_arn_suffix
  target_group_arn_suffix = module.ecs.target_group_arn_suffix
}
```

- [ ] **Step 3: Add monitoring outputs to root output.tf**

Append to `infra/terraform/output.tf`:

```hcl
output "sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  value       = module.monitoring.sns_topic_arn
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = module.monitoring.dashboard_name
}
```

- [ ] **Step 4: Add alarm_email to terraform.tfvars.example**

Append to `infra/terraform/terraform.tfvars.example`:

```hcl
alarm_email    = "your-email@example.com"
```

- [ ] **Step 5: Commit**

```bash
cd /home/hoi9hc/motorShop
git add infra/terraform/main.tf infra/terraform/variables.tf infra/terraform/output.tf infra/terraform/terraform.tfvars.example
git commit -m "infra: wire monitoring module into root terraform config"
```

---

### Task 4: Terraform Plan and Apply (Monitoring)

**Files:** None — Terraform CLI only

- [ ] **Step 1: Add alarm_email to terraform.tfvars**

On your personal PC, add to `infra/terraform/terraform.tfvars`:

```hcl
alarm_email = "your-actual-email@example.com"
```

- [ ] **Step 2: Initialize and plan**

```bash
cd infra/terraform
terraform init
terraform plan
```

Expected: Shows creation of SNS topic, subscription, 4 alarms, dashboard. ~7 new resources.

- [ ] **Step 3: Apply**

```bash
terraform apply
```

- [ ] **Step 4: Confirm SNS subscription**

Check your email for a subscription confirmation from AWS SNS. Click the confirmation link.

- [ ] **Step 5: Verify dashboard**

Go to AWS Console → CloudWatch → Dashboards → `motorshop-dashboard`. Verify it shows 4 widgets: ECS CPU/Memory, ALB Request Count, ALB Response Time, ALB Error Rates.

- [ ] **Step 6: Verify alarms**

Go to AWS Console → CloudWatch → Alarms. Verify 4 alarms exist:
- `motorshop-ecs-unhealthy`
- `motorshop-high-cpu`
- `motorshop-alb-5xx`
- `motorshop-high-latency`

---

## Verification Checklist

- [ ] SNS email subscription confirmed
- [ ] 4 CloudWatch alarms created and in OK state
- [ ] CloudWatch dashboard shows metrics
- [ ] Test alarm by stopping ECS task — should receive email notification

**Milestone:** Full observability with alerting — CloudWatch logs, 4 alarms, SNS email notifications, dashboard.
