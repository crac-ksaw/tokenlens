output "ecs_cluster_name" {
  value = aws_ecs_cluster.tokenlens.name
}

output "postgres_endpoint" {
  value = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}