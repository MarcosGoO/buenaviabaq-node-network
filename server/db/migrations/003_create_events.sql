-- Create events table for tracking urban events that affect traffic
-- (concerts, sports events, road maintenance, protests, etc.)

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL, -- concert, sports, maintenance, protest, accident, etc.
  location_name VARCHAR(255) NOT NULL,
  location_point GEOGRAPHY(POINT, 4326) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_attendance INTEGER,
  traffic_impact VARCHAR(20) NOT NULL DEFAULT 'moderate', -- low, moderate, high, severe
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_end_time ON events(end_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_traffic_impact ON events(traffic_impact);
CREATE INDEX idx_events_location ON events USING GIST(location_point);

-- Create spatial index for location-based queries
CREATE INDEX idx_events_location_gist ON events USING GIST(location_point);

COMMENT ON TABLE events IS 'Urban events that affect traffic patterns in Barranquilla';
COMMENT ON COLUMN events.event_type IS 'Type of event: concert, sports, maintenance, protest, accident, etc.';
COMMENT ON COLUMN events.traffic_impact IS 'Expected traffic impact: low, moderate, high, severe';
COMMENT ON COLUMN events.status IS 'Event status: scheduled, ongoing, completed, cancelled';
