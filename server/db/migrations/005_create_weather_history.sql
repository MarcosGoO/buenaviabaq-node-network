-- Create weather_history table for storing historical weather data
-- This is crucial for ML model training and weather pattern analysis

CREATE TABLE IF NOT EXISTS weather_history (
  time TIMESTAMPTZ NOT NULL,
  temperature INTEGER NOT NULL,
  feels_like INTEGER,
  humidity INTEGER NOT NULL,
  pressure INTEGER NOT NULL,
  wind_speed INTEGER NOT NULL,
  wind_direction INTEGER,
  condition VARCHAR(50) NOT NULL,
  description TEXT,
  rain_1h NUMERIC(5,2) DEFAULT 0,
  rain_probability INTEGER DEFAULT 0,
  cloudiness INTEGER DEFAULT 0,
  visibility INTEGER,
  PRIMARY KEY (time)
);

-- Create indexes for common queries
CREATE INDEX idx_weather_history_time ON weather_history(time DESC);
CREATE INDEX idx_weather_history_condition ON weather_history(condition);
CREATE INDEX idx_weather_history_rain ON weather_history(rain_1h) WHERE rain_1h > 0;

COMMENT ON TABLE weather_history IS 'Historical weather data for Barranquilla - used for ML training and pattern analysis';
COMMENT ON COLUMN weather_history.time IS 'Timestamp when the weather data was recorded';
COMMENT ON COLUMN weather_history.rain_1h IS 'Rainfall in the last hour (mm)';
COMMENT ON COLUMN weather_history.rain_probability IS 'Probability of rain (0-100%)';
