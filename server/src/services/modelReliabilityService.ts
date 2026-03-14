import { pool } from '@/db/index.js';
import { logger } from '@/utils/logger.js';
import { PredictionDriftService, type DriftStatusResponse } from '@/services/predictionDriftService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';
import { ModelGovernanceService, type OperationalDecisionType } from '@/services/modelGovernanceService.js';
import { SocketService } from '@/lib/socket.js';

type IncidentStatus = 'healthy' | 'watch' | 'drift' | 'critical' | 'insufficient_data';
type IncidentFilterStatus = 'open' | 'closed' | 'all';

interface IncidentFilters {
  status?: IncidentFilterStatus;
  limit?: number;
}

function rootMetricFromDrift(drift: DriftStatusResponse): string | null {
  const entries: Array<{ metric: string; value: number | null }> = [
    { metric: 'mae', value: drift.deltas.mae_change_ratio },
    { metric: 'mape', value: drift.deltas.mape_change_ratio },
    { metric: 'rmse', value: drift.deltas.rmse_change_ratio },
  ];
  const sorted = entries
    .filter((entry): entry is { metric: string; value: number } => entry.value !== null)
    .sort((a, b) => b.value - a.value);
  return sorted[0]?.metric ?? null;
}

function severityRank(status: IncidentStatus): number {
  if (status === 'critical') return 4;
  if (status === 'drift') return 3;
  if (status === 'watch') return 2;
  if (status === 'insufficient_data') return 1;
  return 0;
}

function shouldBeIncident(status: IncidentStatus): boolean {
  return status === 'drift' || status === 'critical';
}

function asUtcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDay(input?: string): string {
  if (!input) return asUtcDay(new Date());
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid day format. Expected ISO date.');
  }
  return asUtcDay(parsed);
}

export class ModelReliabilityService {
  static async getOverview(days: number = 30) {
    const boundedDays = Math.min(Math.max(Math.floor(days), 1), 90);

    const [dailyRes, incidentsRes, decisionsRes] = await Promise.all([
      pool.query(
        `
          SELECT
            day,
            samples,
            mae,
            mape,
            rmse,
            p95_error,
            drift_events,
            critical_events
          FROM ml_quality_daily
          WHERE day >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
          ORDER BY day ASC
        `,
        [boundedDays]
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE resolved_at IS NULL)::text as open_count,
            COUNT(*) FILTER (WHERE current_status = 'critical' AND resolved_at IS NULL)::text as open_critical_count,
            COUNT(*)::text as total_count
          FROM ml_drift_incidents
          WHERE started_at >= NOW() - ($1::int * INTERVAL '1 day')
        `,
        [boundedDays]
      ),
      pool.query(
        `
          SELECT
            decision_type,
            COUNT(*)::text as n
          FROM ml_operational_decisions
          WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
          GROUP BY decision_type
        `,
        [boundedDays]
      ),
    ]);

    const decisions: Record<string, number> = {
      keep: 0,
      watch: 0,
      retrain: 0,
      rollback: 0,
    };
    for (const row of decisionsRes.rows) {
      decisions[String(row.decision_type)] = Number(row.n) || 0;
    }

    const aggregates = dailyRes.rows.reduce(
      (acc, row) => {
        acc.total_samples += Number(row.samples) || 0;
        acc.total_drift_events += Number(row.drift_events) || 0;
        acc.total_critical_events += Number(row.critical_events) || 0;
        if (row.mae !== null) acc.mae_values.push(Number(row.mae));
        if (row.mape !== null) acc.mape_values.push(Number(row.mape));
        if (row.rmse !== null) acc.rmse_values.push(Number(row.rmse));
        return acc;
      },
      {
        total_samples: 0,
        total_drift_events: 0,
        total_critical_events: 0,
        mae_values: [] as number[],
        mape_values: [] as number[],
        rmse_values: [] as number[],
      }
    );

    const average = (values: number[]) => {
      if (values.length === 0) return null;
      return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
    };

    const incidents = incidentsRes.rows[0] ?? {};

    return {
      days: boundedDays,
      summary: {
        samples: aggregates.total_samples,
        average_mae: average(aggregates.mae_values),
        average_mape: average(aggregates.mape_values),
        average_rmse: average(aggregates.rmse_values),
        drift_events: aggregates.total_drift_events,
        critical_events: aggregates.total_critical_events,
        open_incidents: Number(incidents.open_count) || 0,
        open_critical_incidents: Number(incidents.open_critical_count) || 0,
        total_incidents: Number(incidents.total_count) || 0,
        decision_counts: decisions,
      },
      daily: dailyRes.rows.map((row) => ({
        day: row.day,
        samples: Number(row.samples) || 0,
        mae: row.mae === null ? null : Number(row.mae),
        mape: row.mape === null ? null : Number(row.mape),
        rmse: row.rmse === null ? null : Number(row.rmse),
        p95_error: row.p95_error === null ? null : Number(row.p95_error),
        drift_events: Number(row.drift_events) || 0,
        critical_events: Number(row.critical_events) || 0,
      })),
    };
  }

  static async getIncidents(filters: IncidentFilters = {}) {
    const status = filters.status ?? 'open';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

    const where: string[] = [];
    if (status === 'open') {
      where.push('resolved_at IS NULL');
    } else if (status === 'closed') {
      where.push('resolved_at IS NOT NULL');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT
        id,
        started_at,
        resolved_at,
        current_status,
        peak_status,
        peak_change_ratio,
        root_metric,
        snapshots_count,
        last_snapshot_at,
        notes,
        created_at,
        updated_at
      FROM ml_drift_incidents
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $1
    `;

    const res = await pool.query(query, [limit]);
    return res.rows.map((row) => ({
      id: Number(row.id),
      started_at: row.started_at,
      resolved_at: row.resolved_at,
      current_status: row.current_status,
      peak_status: row.peak_status,
      peak_change_ratio: row.peak_change_ratio === null ? null : Number(row.peak_change_ratio),
      root_metric: row.root_metric,
      snapshots_count: Number(row.snapshots_count) || 0,
      last_snapshot_at: row.last_snapshot_at,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  static async getDecisions(days: number = 30) {
    const boundedDays = Math.min(Math.max(Math.floor(days), 1), 90);
    const res = await pool.query(
      `
        SELECT
          id,
          decision_type,
          reason,
          confidence_score,
          inputs_json,
          executed,
          executed_at,
          model_version_from,
          model_version_to,
          created_at
        FROM ml_operational_decisions
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        ORDER BY created_at DESC
        LIMIT 500
      `,
      [boundedDays]
    );

    return res.rows.map((row) => ({
      id: Number(row.id),
      decision_type: row.decision_type as OperationalDecisionType,
      reason: row.reason,
      confidence_score: row.confidence_score === null ? null : Number(row.confidence_score),
      inputs: row.inputs_json,
      executed: Boolean(row.executed),
      executed_at: row.executed_at,
      model_version_from: row.model_version_from,
      model_version_to: row.model_version_to,
      created_at: row.created_at,
    }));
  }

  static async openOrUpdateDriftIncident(driftSnapshot: DriftStatusResponse): Promise<{ incidentId: number; action: 'opened' | 'updated' }> {
    const status = driftSnapshot.status as IncidentStatus;
    if (!shouldBeIncident(status)) {
      throw new Error(`Cannot open incident for status '${status}'`);
    }

    const rootMetric = rootMetricFromDrift(driftSnapshot);
    const peakChangeRatio = driftSnapshot.deltas.max_change_ratio;
    const notes = JSON.stringify({
      generated_at: driftSnapshot.generated_at,
      recent_samples: driftSnapshot.recent.samples,
      baseline_samples: driftSnapshot.baseline.samples,
      deltas: driftSnapshot.deltas,
    });

    const openRes = await pool.query(
      `
        SELECT id, peak_status, peak_change_ratio, snapshots_count
        FROM ml_drift_incidents
        WHERE resolved_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      `
    );

    const existing = openRes.rows[0];
    if (!existing) {
      const createRes = await pool.query(
        `
          INSERT INTO ml_drift_incidents (
            started_at, current_status, peak_status, peak_change_ratio,
            root_metric, snapshots_count, last_snapshot_at, notes, created_at, updated_at
          )
          VALUES (NOW(), $1, $1, $2, $3, 1, NOW(), $4, NOW(), NOW())
          RETURNING id
        `,
        [status, peakChangeRatio, rootMetric, notes]
      );
      const incidentId = Number(createRes.rows[0]?.id);
      SocketService.emitReliabilityIncidentOpened({
        incident_id: incidentId,
        status,
        peak_status: status,
        decision_type: null,
        timestamp: new Date().toISOString(),
        max_change_ratio: peakChangeRatio,
      });
      logger.warn('RCC drift incident opened', { incident_id: incidentId, status, peak_change_ratio: peakChangeRatio });
      return { incidentId, action: 'opened' };
    }

    const existingPeakStatus = String(existing.peak_status) as IncidentStatus;
    const existingPeakRatio = existing.peak_change_ratio === null ? null : Number(existing.peak_change_ratio);
    const nextPeakStatus =
      severityRank(status) > severityRank(existingPeakStatus) ? status : existingPeakStatus;
    const nextPeakRatio =
      existingPeakRatio === null
        ? peakChangeRatio
        : peakChangeRatio === null
          ? existingPeakRatio
          : Math.max(existingPeakRatio, peakChangeRatio);

    await pool.query(
      `
        UPDATE ml_drift_incidents
        SET
          current_status = $1,
          peak_status = $2,
          peak_change_ratio = $3,
          root_metric = COALESCE($4, root_metric),
          snapshots_count = snapshots_count + 1,
          last_snapshot_at = NOW(),
          notes = $5,
          updated_at = NOW()
        WHERE id = $6
      `,
      [status, nextPeakStatus, nextPeakRatio, rootMetric, notes, existing.id]
    );

    const incidentId = Number(existing.id);
    logger.warn('RCC drift incident updated', { incident_id: incidentId, status, peak_status: nextPeakStatus });
    return { incidentId, action: 'updated' };
  }

  static async resolveDriftIncidentIfNeeded(
    driftSnapshot: DriftStatusResponse
  ): Promise<{ resolved: boolean; incidentId: number | null }> {
    const status = driftSnapshot.status as IncidentStatus;
    if (shouldBeIncident(status)) {
      return { resolved: false, incidentId: null };
    }

    const openRes = await pool.query(
      `
        SELECT id, current_status
        FROM ml_drift_incidents
        WHERE resolved_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      `
    );

    const openIncident = openRes.rows[0];
    if (!openIncident) {
      return { resolved: false, incidentId: null };
    }

    await pool.query(
      `
        UPDATE ml_drift_incidents
        SET
          current_status = $1,
          resolved_at = NOW(),
          last_snapshot_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `,
      [status, openIncident.id]
    );

    const incidentId = Number(openIncident.id);
    SocketService.emitReliabilityIncidentResolved({
      incident_id: incidentId,
      status,
      decision_type: null,
      timestamp: new Date().toISOString(),
    });
    logger.info('RCC drift incident resolved', { incident_id: incidentId, status });
    return { resolved: true, incidentId };
  }

  static async materializeDailyQuality(day?: string) {
    const dayKey = parseDay(day);
    const [metricsRes, incidentsRes] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*)::text as samples,
            ROUND(AVG(absolute_error)::numeric, 4)::text as mae,
            ROUND(AVG(percentage_error)::numeric, 4)::text as mape,
            ROUND(SQRT(AVG(POWER(predicted_speed_kmh - actual_speed_kmh, 2)))::numeric, 4)::text as rmse,
            ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY absolute_error)::numeric, 4)::text as p95_error
          FROM ml_prediction_feedback
          WHERE actual_speed_kmh IS NOT NULL
            AND target_time >= $1::date
            AND target_time < ($1::date + INTERVAL '1 day')
        `,
        [dayKey]
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE peak_status IN ('drift', 'critical')
            )::text as drift_events,
            COUNT(*) FILTER (
              WHERE peak_status = 'critical'
            )::text as critical_events
          FROM ml_drift_incidents
          WHERE started_at >= $1::date
            AND started_at < ($1::date + INTERVAL '1 day')
        `,
        [dayKey]
      ),
    ]);

    const metrics = metricsRes.rows[0] ?? {};
    const incidents = incidentsRes.rows[0] ?? {};

    await pool.query(
      `
        INSERT INTO ml_quality_daily (
          day, samples, mae, mape, rmse, p95_error,
          drift_events, critical_events, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (day)
        DO UPDATE SET
          samples = EXCLUDED.samples,
          mae = EXCLUDED.mae,
          mape = EXCLUDED.mape,
          rmse = EXCLUDED.rmse,
          p95_error = EXCLUDED.p95_error,
          drift_events = EXCLUDED.drift_events,
          critical_events = EXCLUDED.critical_events,
          updated_at = NOW()
      `,
      [
        dayKey,
        Number(metrics.samples) || 0,
        metrics.mae === null ? null : Number(metrics.mae),
        metrics.mape === null ? null : Number(metrics.mape),
        metrics.rmse === null ? null : Number(metrics.rmse),
        metrics.p95_error === null ? null : Number(metrics.p95_error),
        Number(incidents.drift_events) || 0,
        Number(incidents.critical_events) || 0,
      ]
    );

    const result = {
      day: dayKey,
      samples: Number(metrics.samples) || 0,
      mae: metrics.mae === null ? null : Number(metrics.mae),
      mape: metrics.mape === null ? null : Number(metrics.mape),
      rmse: metrics.rmse === null ? null : Number(metrics.rmse),
      p95_error: metrics.p95_error === null ? null : Number(metrics.p95_error),
      drift_events: Number(incidents.drift_events) || 0,
      critical_events: Number(incidents.critical_events) || 0,
    };

    logger.info('RCC daily quality materialized', result);
    return result;
  }

  static async runReliabilityCheckNow(options?: {
    lookbackHours?: number;
    toleranceMinutes?: number;
    recentHours?: number;
    baselineDays?: number;
    minSamples?: number;
    governanceDays?: number;
  }) {
    const lookbackHours = options?.lookbackHours ?? 72;
    const toleranceMinutes = options?.toleranceMinutes ?? 30;
    const recentHours = options?.recentHours ?? 24;
    const baselineDays = options?.baselineDays ?? 30;
    const minSamples = options?.minSamples ?? 40;
    const governanceDays = options?.governanceDays ?? 30;

    const sync = await PredictionEvaluationService.syncActualValues(lookbackHours, toleranceMinutes);
    const drift = await PredictionDriftService.getDriftStatus(recentHours, baselineDays, minSamples);

    let incidentAction: 'opened' | 'updated' | 'resolved' | 'none' = 'none';
    let incidentId: number | null = null;

    if (shouldBeIncident(drift.status as IncidentStatus)) {
      const incident = await this.openOrUpdateDriftIncident(drift);
      incidentAction = incident.action;
      incidentId = incident.incidentId;
    } else {
      const resolution = await this.resolveDriftIncidentIfNeeded(drift);
      incidentAction = resolution.resolved ? 'resolved' : 'none';
      incidentId = resolution.incidentId;
    }

    const governanceInput = await ModelGovernanceService.buildGovernanceInput(governanceDays);
    const recommendation = ModelGovernanceService.evaluateOperationalDecision(governanceInput);
    const decisionId = await ModelGovernanceService.persistDecision({
      decisionType: recommendation.decisionType,
      reason: recommendation.reason,
      confidenceScore: recommendation.confidenceScore,
      inputs: recommendation.evidence,
      modelVersionFrom: recommendation.modelVersionFrom,
      modelVersionTo: recommendation.modelVersionTo,
    });

    SocketService.emitReliabilityDecisionRecommended({
      incident_id: incidentId,
      status: drift.status,
      decision_type: recommendation.decisionType,
      timestamp: new Date().toISOString(),
      confidence_score: recommendation.confidenceScore,
      decision_id: decisionId,
      max_change_ratio: drift.deltas.max_change_ratio,
    });

    SocketService.emitReliabilityUpdate({
      incident_id: incidentId,
      status: drift.status,
      decision_type: recommendation.decisionType,
      timestamp: new Date().toISOString(),
      sync_updated: sync.updated,
      decision_id: decisionId,
      incident_action: incidentAction,
      max_change_ratio: drift.deltas.max_change_ratio,
      recent_samples: drift.recent.samples,
      baseline_samples: drift.baseline.samples,
    });

    return {
      sync,
      drift,
      incident: {
        action: incidentAction,
        incident_id: incidentId,
      },
      recommendation: {
        decision_id: decisionId,
        decision_type: recommendation.decisionType,
        reason: recommendation.reason,
        confidence_score: recommendation.confidenceScore,
        evidence: recommendation.evidence,
      },
    };
  }
}
