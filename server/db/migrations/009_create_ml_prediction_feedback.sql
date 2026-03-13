-- Prediction feedback loop for temporal evaluation and drift monitoring

CREATE TABLE IF NOT EXISTS ml_prediction_feedback (
  id BIGSERIAL PRIMARY KEY,
  road_id INTEGER NOT NULL,
  zone_id INTEGER,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_time TIMESTAMPTZ NOT NULL,
  horizon_minutes INTEGER,
  predicted_speed_kmh FLOAT NOT NULL,
  actual_speed_kmh FLOAT,
  absolute_error FLOAT,
  percentage_error FLOAT,
  model_version VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mlpred_feedback_road_target
  ON ml_prediction_feedback(road_id, target_time DESC);

CREATE INDEX IF NOT EXISTS idx_mlpred_feedback_predicted_at
  ON ml_prediction_feedback(predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_mlpred_feedback_horizon
  ON ml_prediction_feedback(horizon_minutes);

CREATE INDEX IF NOT EXISTS idx_mlpred_feedback_zone
  ON ml_prediction_feedback(zone_id);

CREATE INDEX IF NOT EXISTS idx_mlpred_feedback_actual_null
  ON ml_prediction_feedback(actual_speed_kmh)
  WHERE actual_speed_kmh IS NULL;

COMMENT ON TABLE ml_prediction_feedback IS 'Stores prediction vs observed outcomes for temporal evaluation.';
COMMENT ON COLUMN ml_prediction_feedback.target_time IS 'Timestamp the model predicted for (predicted_at + horizon).';

