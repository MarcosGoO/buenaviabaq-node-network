import { pool } from '@/db/index.js';
import { logger } from '@/utils/logger.js';

export interface PredictionFeedbackInput {
  road_id: number;
  zone_id?: number | null;
  predicted_at: Date;
  target_time: Date;
  horizon_minutes?: number | null;
  predicted_speed_kmh: number;
  model_version?: string | null;
}

interface MetricRow {
  n: string;
  mae: string | null;
  mape: string | null;
  rmse: string | null;
  p95: string | null;
}

export class PredictionEvaluationService {
  static async recordPrediction(input: PredictionFeedbackInput): Promise<void> {
    try {
      let zoneId = input.zone_id ?? null;
      if (zoneId === null) {
        const zoneRes = await pool.query(
          'SELECT (metadata->>\'zone_id\')::int as zone_id FROM geo.roads WHERE id = $1 LIMIT 1',
          [input.road_id]
        );
        zoneId = zoneRes.rows[0]?.zone_id ?? null;
      }

      await pool.query(
        `
          INSERT INTO ml_prediction_feedback (
            road_id, zone_id, predicted_at, target_time, horizon_minutes,
            predicted_speed_kmh, model_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          input.road_id,
          zoneId,
          input.predicted_at,
          input.target_time,
          input.horizon_minutes ?? null,
          input.predicted_speed_kmh,
          input.model_version ?? null,
        ]
      );
    } catch (error) {
      logger.error('Failed to record prediction feedback:', error);
    }
  }

  static async syncActualValues(
    lookbackHours: number = 72,
    toleranceMinutes: number = 30
  ): Promise<{ updated: number }> {
    const query = `
      WITH candidates AS (
        SELECT
          f.id as feedback_id,
          th.speed_kmh as observed_speed,
          ABS(EXTRACT(EPOCH FROM (th.time - f.target_time))) as diff_seconds,
          ROW_NUMBER() OVER (
            PARTITION BY f.id
            ORDER BY ABS(EXTRACT(EPOCH FROM (th.time - f.target_time))) ASC
          ) as rn
        FROM ml_prediction_feedback f
        JOIN traffic_history th
          ON th.road_id = f.road_id
         AND th.time BETWEEN
           f.target_time - ($2::int * INTERVAL '1 minute')
           AND f.target_time + ($2::int * INTERVAL '1 minute')
        WHERE f.actual_speed_kmh IS NULL
          AND f.predicted_at >= NOW() - ($1::int * INTERVAL '1 hour')
      ),
      best AS (
        SELECT feedback_id, observed_speed
        FROM candidates
        WHERE rn = 1
      )
      UPDATE ml_prediction_feedback f
      SET
        actual_speed_kmh = b.observed_speed,
        absolute_error = ABS(f.predicted_speed_kmh - b.observed_speed),
        percentage_error = CASE
          WHEN b.observed_speed = 0 THEN NULL
          ELSE ABS((f.predicted_speed_kmh - b.observed_speed) / b.observed_speed) * 100
        END,
        updated_at = NOW()
      FROM best b
      WHERE f.id = b.feedback_id
    `;

    const result = await pool.query(query, [lookbackHours, toleranceMinutes]);
    const updated = result.rowCount ?? 0;
    logger.info(`Prediction feedback sync completed: ${updated} rows updated`);
    return { updated };
  }

  static async getTemporalEvaluation(days: number = 14) {
    const params = [days];
    const overallQuery = `
      SELECT
        COUNT(*)::text as n,
        ROUND(AVG(absolute_error)::numeric, 3)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 3)::text as mape,
        ROUND(SQRT(AVG(POWER(predicted_speed_kmh - actual_speed_kmh, 2)))::numeric, 3)::text as rmse,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY absolute_error)::numeric, 3)::text as p95
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= NOW() - ($1::int * INTERVAL '1 day')
    `;

    const byHorizonQuery = `
      SELECT
        COALESCE(horizon_minutes, 0) as horizon_minutes,
        COUNT(*)::text as n,
        ROUND(AVG(absolute_error)::numeric, 3)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 3)::text as mape,
        ROUND(SQRT(AVG(POWER(predicted_speed_kmh - actual_speed_kmh, 2)))::numeric, 3)::text as rmse,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY absolute_error)::numeric, 3)::text as p95
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY horizon_minutes
      ORDER BY horizon_minutes
    `;

    const byZoneQuery = `
      SELECT
        COALESCE(zone_id, -1) as zone_id,
        COUNT(*)::text as n,
        ROUND(AVG(absolute_error)::numeric, 3)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 3)::text as mape
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY zone_id
      ORDER BY COUNT(*) DESC, zone_id
      LIMIT 20
    `;

    const byHourQuery = `
      SELECT
        EXTRACT(HOUR FROM target_time)::int as hour_of_day,
        COUNT(*)::text as n,
        ROUND(AVG(absolute_error)::numeric, 3)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 3)::text as mape
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `;

    const rushHourQuery = `
      SELECT
        CASE
          WHEN EXTRACT(HOUR FROM target_time) BETWEEN 6 AND 9
             OR EXTRACT(HOUR FROM target_time) BETWEEN 17 AND 20
          THEN 'rush_hour'
          ELSE 'non_rush_hour'
        END as bucket,
        COUNT(*)::text as n,
        ROUND(AVG(absolute_error)::numeric, 3)::text as mae,
        ROUND(AVG(percentage_error)::numeric, 3)::text as mape
      FROM ml_prediction_feedback
      WHERE actual_speed_kmh IS NOT NULL
        AND predicted_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY bucket
      ORDER BY bucket
    `;

    const [overallRes, byHorizonRes, byZoneRes, byHourRes, rushHourRes] = await Promise.all([
      pool.query(overallQuery, params),
      pool.query(byHorizonQuery, params),
      pool.query(byZoneQuery, params),
      pool.query(byHourQuery, params),
      pool.query(rushHourQuery, params),
    ]);

    const overall = overallRes.rows[0] as MetricRow | undefined;
    return {
      window_days: days,
      overall: overall
        ? {
            samples: Number(overall.n) || 0,
            mae: overall.mae ? Number(overall.mae) : null,
            mape: overall.mape ? Number(overall.mape) : null,
            rmse: overall.rmse ? Number(overall.rmse) : null,
            p95_error: overall.p95 ? Number(overall.p95) : null,
          }
        : { samples: 0, mae: null, mape: null, rmse: null, p95_error: null },
      by_horizon: byHorizonRes.rows.map((row) => ({
        horizon_minutes: Number(row.horizon_minutes),
        samples: Number(row.n) || 0,
        mae: row.mae ? Number(row.mae) : null,
        mape: row.mape ? Number(row.mape) : null,
        rmse: row.rmse ? Number(row.rmse) : null,
        p95_error: row.p95 ? Number(row.p95) : null,
      })),
      by_zone: byZoneRes.rows.map((row) => ({
        zone_id: Number(row.zone_id),
        samples: Number(row.n) || 0,
        mae: row.mae ? Number(row.mae) : null,
        mape: row.mape ? Number(row.mape) : null,
      })),
      by_hour: byHourRes.rows.map((row) => ({
        hour_of_day: Number(row.hour_of_day),
        samples: Number(row.n) || 0,
        mae: row.mae ? Number(row.mae) : null,
        mape: row.mape ? Number(row.mape) : null,
      })),
      by_rush_hour: rushHourRes.rows.map((row) => ({
        bucket: String(row.bucket),
        samples: Number(row.n) || 0,
        mae: row.mae ? Number(row.mae) : null,
        mape: row.mape ? Number(row.mape) : null,
      })),
    };
  }
}
