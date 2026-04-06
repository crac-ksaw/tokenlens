variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "db_username" {
  type    = string
  default = "tokenlens"
}

variable "db_password" {
  type      = string
  sensitive = true
}