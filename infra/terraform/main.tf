terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "tokenlens" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "tokenlens" }
}

resource "aws_ecs_cluster" "tokenlens" {
  name = "tokenlens"
}

resource "aws_ecr_repository" "api" { name = "tokenlens-api" }
resource "aws_ecr_repository" "worker" { name = "tokenlens-worker" }
resource "aws_ecr_repository" "web" { name = "tokenlens-web" }

resource "aws_db_instance" "postgres" {
  identifier           = "tokenlens-postgres"
  engine               = "postgres"
  engine_version       = "16.3"
  instance_class       = "db.t4g.medium"
  allocated_storage    = 50
  username             = var.db_username
  password             = var.db_password
  db_name              = "tokenlens"
  skip_final_snapshot  = true
  publicly_accessible  = false
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "tokenlens-redis"
  engine               = "redis"
  node_type            = "cache.t4g.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
}