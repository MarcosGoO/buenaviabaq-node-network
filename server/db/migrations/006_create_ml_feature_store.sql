-- Create ML feature store table
-- This table stores pre-computed features for machine learning models

CREATE TABLE IF NOT EXISTS ml_features (
  id SERIAL PRIMARY KEY,
  road_id INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,

  -- Temporal features
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  day_of_month INTEGER NOT NULL,
  month INTEGER NOT NULL,
  is_rush_hour BOOLEAN NOT NULL,
  is_weekend BOOLEAN NOT NULL,

  -- Traffic historical features (from traffic_history aggregations)
  avg_speed_historical FLOAT,
  avg_congestion_level_encoded FLOAT, -- 0=low, 0.33=moderate, 0.66=high, 1=severe
  traffic_std_deviation FLOAT,

  -- Weather features
  temperature FLOAT,
  humidity FLOAT,
  wind_speed FLOAT,
  rain_probability FLOAT,
  weather_condition_encoded INTEGER, -- 0=Clear, 1=Clouds, 2=Rain, etc.
  is_raining BOOLEAN,

  -- Event features
  event_nearby BOOLEAN,
  event_type_encoded INTEGER, -- 0=none, 1=concert, 2=sports, 3=maintenance, etc.
  event_distance_km FLOAT,

  -- Geographic features
  zone_id INTEGER,
  road_type_encoded INTEGER, -- 0=highway, 1=avenue, 2=street, 3=transversal, 4=diagonal
  lanes INTEGER,
  max_speed_kmh INTEGER,

  -- Arroyo risk features
  arroyo_nearby BOOLEAN,
  arroyo_risk_level_encoded FLOAT, -- 0=none, 0.25=low, 0.5=medium, 0.75=high, 1=critical
  arroyo_distance_km FLOAT,

  -- Target variable (for training)
  target_speed_kmh INTEGER,
  target_congestion_level VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(road_id, timestamp)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ml_features_road_id ON ml_features(road_id);
CREATE INDEX IF NOT EXISTS idx_ml_features_timestamp ON ml_features(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ml_features_road_time ON ml_features(road_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ml_features_temporal ON ml_features(hour_of_day, day_of_week);

COMMENT ON TABLE ml_features IS 'Pre-computed features for ML models - traffic prediction';
COMMENT ON COLUMN ml_features.avg_speed_historical IS 'Average speed for this road at similar time from historical data';
COMMENT ON COLUMN ml_features.weather_condition_encoded IS 'Encoded weather condition (Clear=0, Clouds=1, Rain=2, Drizzle=3, etc.)';
COMMENT ON COLUMN ml_features.road_type_encoded IS 'Encoded road type based on road name patterns';