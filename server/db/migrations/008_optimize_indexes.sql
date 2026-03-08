-- Sprint 6.3 - Query optimization indexes

-- traffic_history: optimize zone + time range lookups
CREATE INDEX IF NOT EXISTS idx_traffic_history_zone_time
  ON traffic_history(zone_id, recorded_at DESC);

-- events: optimize active events by date + zone
CREATE INDEX IF NOT EXISTS idx_events_date_zone_active
  ON events(start_date, zone_id)
  WHERE active = true;

-- arroyos: optimize active arroyos by risk level
CREATE INDEX IF NOT EXISTS idx_arroyos_risk_active
  ON arroyos(risk_level)
  WHERE active = true;

