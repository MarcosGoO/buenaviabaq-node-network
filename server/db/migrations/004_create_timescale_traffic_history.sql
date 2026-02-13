-- Create traffic history table for time-series data
-- This table stores snapshots of traffic conditions every 5 minutes

CREATE TABLE IF NOT EXISTS traffic_history (
  time TIMESTAMPTZ NOT NULL,
  road_id INTEGER NOT NULL,
  road_name VARCHAR(255) NOT NULL,
  zone_id INTEGER,
  congestion_level VARCHAR(20) NOT NULL, -- low, moderate, high, severe
  speed_kmh INTEGER NOT NULL,
  travel_time_minutes INTEGER,
  vehicles_count INTEGER,
  weather_condition VARCHAR(50),
  temperature INTEGER,
  is_raining BOOLEAN DEFAULT FALSE,
  event_nearby BOOLEAN DEFAULT FALSE,
  day_of_week INTEGER, -- 0=Sunday, 6=Saturday
  hour_of_day INTEGER,
  is_rush_hour BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (time, road_id)
);

-- Create indexes for common queries
CREATE INDEX idx_traffic_history_time ON traffic_history(time DESC);
CREATE INDEX idx_traffic_history_road_id ON traffic_history(road_id);
CREATE INDEX idx_traffic_history_zone_id ON traffic_history(zone_id);
CREATE INDEX idx_traffic_history_congestion ON traffic_history(congestion_level);
CREATE INDEX idx_traffic_history_day_hour ON traffic_history(day_of_week, hour_of_day);

-- Create composite index for time-series queries
CREATE INDEX idx_traffic_history_road_time ON traffic_history(road_id, time DESC);

COMMENT ON TABLE traffic_history IS 'Time-series data of traffic conditions for ML training and analytics';
COMMENT ON COLUMN traffic_history.time IS 'Timestamp of the traffic snapshot';
COMMENT ON COLUMN traffic_history.is_rush_hour IS 'Whether this snapshot was during rush hour (6-9am or 5-8pm)';
COMMENT ON COLUMN traffic_history.event_nearby IS 'Whether there was an event affecting this road';
