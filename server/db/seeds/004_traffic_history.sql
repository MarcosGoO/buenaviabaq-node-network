-- Seed historical traffic data for the last 7 days
-- This generates sample data for ML training and analytics

-- Function to generate traffic data for a specific time
CREATE OR REPLACE FUNCTION generate_traffic_snapshot(snapshot_time TIMESTAMPTZ) RETURNS VOID AS $$
DECLARE
  hour_val INTEGER;
  day_val INTEGER;
  is_rush BOOLEAN;
  base_speed INTEGER;
  speed_var INTEGER;
BEGIN
  hour_val := EXTRACT(HOUR FROM snapshot_time);
  day_val := EXTRACT(DOW FROM snapshot_time);

  -- Rush hour: 6-9am or 5-8pm on weekdays
  is_rush := (day_val BETWEEN 1 AND 5) AND ((hour_val BETWEEN 6 AND 9) OR (hour_val BETWEEN 17 AND 20));

  -- Base speed depends on rush hour
  base_speed := CASE WHEN is_rush THEN 25 ELSE 50 END;

  -- Insert data for each road
  INSERT INTO traffic_history (
    time, road_id, road_name, zone_id, congestion_level,
    speed_kmh, travel_time_minutes, vehicles_count,
    weather_condition, temperature, is_raining, event_nearby,
    day_of_week, hour_of_day, is_rush_hour
  )
  SELECT
    snapshot_time,
    r.id,
    r.name,
    1, -- Default zone
    CASE
      WHEN speed > 50 THEN 'low'
      WHEN speed > 35 THEN 'moderate'
      WHEN speed > 20 THEN 'high'
      ELSE 'severe'
    END,
    speed,
    ROUND((10.0 / NULLIF(speed, 0)) * 60)::INTEGER, -- 10km distance
    ROUND(50 + RANDOM() * 200)::INTEGER, -- vehicles count
    CASE WHEN RANDOM() > 0.8 THEN 'rain' ELSE 'clear' END,
    ROUND(28 + RANDOM() * 6)::INTEGER, -- 28-34°C
    RANDOM() > 0.8,
    RANDOM() > 0.9,
    day_val,
    hour_val,
    is_rush
  FROM (
    SELECT
      id,
      name,
      (base_speed + ROUND(RANDOM() * 25 - 5))::INTEGER as speed
    FROM (
      VALUES
        (1, 'Vía 40'),
        (2, 'Calle 30'),
        (3, 'Calle 72'),
        (4, 'Circunvalar'),
        (5, 'Carrera 38'),
        (6, 'Cordialidad')
    ) AS roads(id, name)
  ) r;
END;
$$ LANGUAGE plpgsql;

-- Generate data for the last 7 days, every 15 minutes
DO $$
DECLARE
  snapshot_ts TIMESTAMPTZ;
  end_ts TIMESTAMPTZ;
BEGIN
  end_ts := NOW();
  snapshot_ts := end_ts - INTERVAL '7 days';

  WHILE snapshot_ts <= end_ts LOOP
    PERFORM generate_traffic_snapshot(snapshot_ts);
    snapshot_ts := snapshot_ts + INTERVAL '15 minutes';
  END LOOP;
END $$;

-- Drop the temporary function
DROP FUNCTION generate_traffic_snapshot;

-- Verify data inserted
SELECT
  COUNT(*) as total_records,
  MIN(time) as earliest,
  MAX(time) as latest,
  COUNT(DISTINCT road_id) as roads_tracked
FROM traffic_history;
