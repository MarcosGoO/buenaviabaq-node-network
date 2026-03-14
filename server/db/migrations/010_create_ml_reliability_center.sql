-- Sprint 6.4 - Reliability Control Center (RCC) persistence

CREATE TABLE IF NOT EXISTS ml_drift_incidents (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  current_status VARCHAR(32) NOT NULL,
  peak_status VARCHAR(32) NOT NULL,
  peak_change_ratio FLOAT,
  root_metric VARCHAR(64),
  snapshots_count INTEGER NOT NULL DEFAULT 1,
  last_snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_operational_decisions (
  id BIGSERIAL PRIMARY KEY,
  decision_type VARCHAR(16) NOT NULL CHECK (decision_type IN ('keep', 'watch', 'retrain', 'rollback')),
  reason TEXT NOT NULL,
  confidence_score FLOAT,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  model_version_from VARCHAR(64),
  model_version_to VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_quality_daily (
  day DATE PRIMARY KEY,
  samples INTEGER NOT NULL DEFAULT 0,
  mae FLOAT,
  mape FLOAT,
  rmse FLOAT,
  p95_error FLOAT,
  drift_events INTEGER NOT NULL DEFAULT 0,
  critical_events INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_drift_incidents_status_resolved
  ON ml_drift_incidents(current_status, resolved_at);

CREATE INDEX IF NOT EXISTS idx_ml_drift_incidents_open_last_snapshot
  ON ml_drift_incidents(last_snapshot_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ml_drift_incidents_started_at
  ON ml_drift_incidents(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_operational_decisions_type_created
  ON ml_operational_decisions(decision_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_operational_decisions_created_at
  ON ml_operational_decisions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_operational_decisions_executed
  ON ml_operational_decisions(executed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_quality_daily_day
  ON ml_quality_daily(day DESC);

COMMENT ON TABLE ml_drift_incidents IS 'Persisted model drift incidents aggregated from periodic drift snapshots.';
COMMENT ON TABLE ml_operational_decisions IS 'Audit log of RCC governance decisions and optional execution state.';
COMMENT ON TABLE ml_quality_daily IS 'Daily materialized prediction quality metrics for reliability overviews.';
