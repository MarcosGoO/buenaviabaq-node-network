-- 1. Enable TimescaleDB extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Convert traffic_history into an hypertable
SELECT create_hypertable('traffic_history', 'time', migrate_data => true, if_not_exists => true);

-- 3. Create a continuous aggregate for hourly traffic stats (Materialized View)
-- This improves performance for the analytics dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_traffic_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  road_id,
  AVG(speed_kmh) AS avg_speed,
  MAX(congestion_level) AS max_congestion,
  COUNT(*) as snapshot_count
FROM traffic_history
GROUP BY bucket, road_id;

-- 4. Create a refresh policy for the continuous aggregate
-- Refresh data older than 2 hours, up to the last 15 minutes, running every hour
SELECT add_continuous_aggregate_policy('hourly_traffic_stats',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);
