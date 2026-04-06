CREATE TABLE IF NOT EXISTS llm_events (
  event_id UUID DEFAULT generateUUIDv4(),
  workspace_id String,
  feature String,
  user_id String,
  session_id String,
  environment Enum8(''production'' = 1, ''staging'' = 2, ''development'' = 3),
  provider String,
  model String,
  tokens_prompt UInt32,
  tokens_completion UInt32,
  tokens_total UInt32,
  usd_cost Float64,
  latency_ms UInt32,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (workspace_id, feature, toStartOfHour(created_at))
PARTITION BY toYYYYMM(created_at)
TTL created_at + INTERVAL 2 YEAR;