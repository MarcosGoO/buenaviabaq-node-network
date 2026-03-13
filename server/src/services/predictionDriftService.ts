import { pool } from '@/db/index.js';

interface MetricsSnapshot {
  samples: number;
  mae: number | null;
  mape: number | null;
  rmse: number | null;
  p95_error: number | null;
}

type DriftLevel = 'healthy' | 'watch' | 'drift' | 'critical' | 'insufficient_data';

interface DriftThresholds {
  watch: number;
  drift: number;
  critical: number;
}

export interface DriftStatusResponse {
  status: DriftLevel;
  generated_at: string;
  windows: {
    recent_hours: number;
    baseline_days: number;
    min_samples: number;
  };
  recent: MetricsSnapshot;
  baseline: MetricsSnapshot;
  deltas: {
    mae_change_ratio: number | null;
    mape_change_ratio: number | null;
    rmse_change_ratio: number | null;
    max_change_ratio: number | null;
  };
  thresholds: DriftThresholds;
}

interface RawMetricRow {
  samples: string;
  mae: string | null;
  mape: string | null;
  rmse: string | null;
  p95_error: string | null;
}

const DEFAULT_RECENT_HOURS = 24;
const DEFAULT_BASELINE_DAYS = 30;
const DEFAULT_MIN_SAMPLES = 40;

function parseEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getThresholds(): DriftThresholds {
  return {
    watch: parseEnvFloat('ML_DRIFT_WATCH_THRESHOLD', 0.1),
    drift: parseEnvFloat('ML_DRIFT_THRESHOLD', 0.2),
    critical: parseEnvFloat('ML_DRIFT_CRITICAL_THRESHOLD', 0.35),
  };
}

function toSnapshot(row: RawMetricRow | undefined): MetricsSnapshot {
  if (!row) {
    return {
      samples: 0,
      mae: null,
      mape: null,
      rmse: null,
      p95_error: null,
    };
  }

  return {
    samples: Number(row.samples) || 0,
    mae: row.mae === null ? null : Number(row.mae),
    mape: row.mape === null ? null : Number(row.mape),
    rmse: row.rmse === null ? null : Number(row.rmse),
    p95_error: row.p95_error === null ? null : Number(row.p95_error),
  };
}

function ratioChange(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline <= 0) {
    return null;
  }
  return (current - baseline) / baseline;
}

export class PredictionDriftService {
  static async getDriftStatus(
    recentHours: number = DEFAULT_RECENT_HOURS,
    baselineDays: number = DEFAULT_BASELINE_DAYS,
    minSamples: number = DEFAULT_MIN_SAMPLES
  ): Promise<DriftStatusResponse> {
    const query = `
      SELECT
        COUNT(*)::text as samples,
        ROUND(AVG(absolute_error)::numeric, 4)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 4)::text as mape,
        ROUND(SQRT(AVG(POWER(predicted_speed_kmh - actual_speed_kmh, 2)))::numeric, 4)::text as rmse,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY absolute_error)::numeric, 4)::text as p95_error
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= $1
        AND predicted_at < $2
    `;

    const now = new Date();
    const recentStart = new Date(now.getTime() - recentHours * 60 * 60 * 1000);
    const baselineEnd = recentStart;
    const baselineStart = new Date(baselineEnd.getTime() - baselineDays * 24 * 60 * 60 * 1000);

    const [recentRes, baselineRes] = await Promise.all([
      pool.query(query, [recentStart, now]),
      pool.query(query, [baselineStart, baselineEnd]),
    ]);

    const recent = toSnapshot(recentRes.rows[0] as RawMetricRow | undefined);
    const baseline = toSnapshot(baselineRes.rows[0] as RawMetricRow | undefined);
    const thresholds = getThresholds();

    const maeDelta = ratioChange(recent.mae, baseline.mae);
    const mapeDelta = ratioChange(recent.mape, baseline.mape);
    const rmseDelta = ratioChange(recent.rmse, baseline.rmse);
    const nonNullDeltas = [maeDelta, mapeDelta, rmseDelta].filter((v): v is number => v !== null);
    const maxChange = nonNullDeltas.length > 0 ? Math.max(...nonNullDeltas) : null;

    let status: DriftLevel = 'healthy';
    if (recent.samples < minSamples || baseline.samples < minSamples || maxChange === null) {
      status = 'insufficient_data';
    } else if (maxChange >= thresholds.critical) {
      status = 'critical';
    } else if (maxChange >= thresholds.drift) {
      status = 'drift';
    } else if (maxChange >= thresholds.watch) {
      status = 'watch';
    }

    return {
      status,
      generated_at: now.toISOString(),
      windows: {
        recent_hours: recentHours,
        baseline_days: baselineDays,
        min_samples: minSamples,
      },
      recent,
      baseline,
      deltas: {
        mae_change_ratio: maeDelta,
        mape_change_ratio: mapeDelta,
        rmse_change_ratio: rmseDelta,
        max_change_ratio: maxChange,
      },
      thresholds,
    };
  }
}
