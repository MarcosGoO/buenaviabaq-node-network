import { pool } from '@/db/index.js';
import { logger } from '@/utils/logger.js';
import { PredictionDriftService, type DriftStatusResponse } from '@/services/predictionDriftService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';
import { MLPredictionService } from '@/services/mlPredictionService.js';
import { dataCollectionQueue, JobTypes } from '@/jobs/queues.js';

export type OperationalDecisionType = 'keep' | 'watch' | 'retrain' | 'rollback';

export interface GovernanceInput {
  drift: DriftStatusResponse;
  driftTrend: {
    watch: number;
    drift: number;
    critical: number;
  };
  recentSamples: number;
  baselineSamples: number;
  qualityTrend: {
    recentMae: number | null;
    baselineMae: number | null;
    maeChangeRatio: number | null;
  };
  modelVersionFrom?: string | null;
  modelVersionTo?: string | null;
}

export interface GovernanceDecision {
  decisionType: OperationalDecisionType;
  reason: string;
  confidenceScore: number;
  evidence: Record<string, unknown>;
  modelVersionFrom: string | null;
  modelVersionTo: string | null;
}

interface PersistDecisionInput {
  decisionType: OperationalDecisionType;
  reason: string;
  confidenceScore: number;
  inputs: Record<string, unknown>;
  modelVersionFrom?: string | null;
  modelVersionTo?: string | null;
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(input: number): number {
  if (!Number.isFinite(input)) return 0;
  if (input < 0) return 0;
  if (input > 1) return 1;
  return Number(input.toFixed(3));
}

function safeNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const asNum = Number(input);
  return Number.isFinite(asNum) ? asNum : null;
}

export class ModelGovernanceService {
  static async buildGovernanceInput(days: number = 30): Promise<GovernanceInput> {
    const boundedDays = Math.min(Math.max(days, 7), 60);
    const [drift, evaluation, trendRes, modelHistory] = await Promise.all([
      PredictionDriftService.getDriftStatus(),
      PredictionEvaluationService.getTemporalEvaluation(Math.max(7, Math.floor(boundedDays / 2))),
      pool.query(
        `
          SELECT current_status, COUNT(*)::text as n
          FROM ml_drift_incidents
          WHERE started_at >= NOW() - ($1::int * INTERVAL '1 day')
          GROUP BY current_status
        `,
        [boundedDays]
      ),
      MLPredictionService.getModelHistory(),
    ]);

    const counts = {
      watch: 0,
      drift: 0,
      critical: 0,
    };
    for (const row of trendRes.rows) {
      const status = String(row.current_status ?? '');
      const n = Number(row.n) || 0;
      if (status === 'watch') counts.watch = n;
      if (status === 'drift') counts.drift = n;
      if (status === 'critical') counts.critical = n;
    }

    const recentMae = safeNumber(evaluation.overall.mae);
    const baselineRow = await pool.query(
      `
        SELECT mae
        FROM ml_quality_daily
        WHERE day >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
          AND day < CURRENT_DATE - ($2::int * INTERVAL '1 day')
          AND samples > 0
          AND mae IS NOT NULL
        ORDER BY day DESC
        LIMIT 1
      `,
      [boundedDays, Math.max(1, Math.floor(boundedDays / 2))]
    );
    const baselineMae = safeNumber(baselineRow.rows[0]?.mae);
    const maeChangeRatio =
      recentMae !== null && baselineMae !== null && baselineMae > 0
        ? (recentMae - baselineMae) / baselineMae
        : drift.deltas.mae_change_ratio;

    return {
      drift,
      driftTrend: counts,
      recentSamples: drift.recent.samples,
      baselineSamples: drift.baseline.samples,
      qualityTrend: {
        recentMae,
        baselineMae,
        maeChangeRatio,
      },
      modelVersionFrom: modelHistory?.active_model_version ?? null,
      modelVersionTo: modelHistory?.versions?.[1]?.version ?? null,
    };
  }

  static evaluateOperationalDecision(input: GovernanceInput): GovernanceDecision {
    const sustainedDriftDays = Math.max(1, Math.floor(envFloat('ML_RCC_SUSTAINED_DRIFT_DAYS', 2)));
    const rollbackCriticalRatio = envFloat('ML_RCC_ROLLBACK_CRITICAL_RATIO', 0.12);
    const retrainMaeRatio = envFloat('ML_RCC_RETRAIN_MAE_RATIO', 0.1);
    const minimumSamples = Math.max(1, Math.floor(envFloat('ML_RCC_MIN_SAMPLES', 40)));
    const allowRollback = envFlag('ML_RCC_ALLOW_ROLLBACK', true);

    const hasSufficientSamples = input.recentSamples >= minimumSamples && input.baselineSamples >= minimumSamples;
    const driftStatus = input.drift.status;
    const sustainedDriftCount = input.driftTrend.drift + input.driftTrend.critical;
    const maeChangeRatio = input.qualityTrend.maeChangeRatio ?? 0;

    let decisionType: OperationalDecisionType = 'watch';
    let reason = 'Insufficient evidence to maintain stable operation';

    if (!hasSufficientSamples || driftStatus === 'insufficient_data') {
      decisionType = 'watch';
      reason = 'Insufficient sample volume for deterministic retraining decision';
    } else if (allowRollback && driftStatus === 'critical' && maeChangeRatio >= rollbackCriticalRatio) {
      decisionType = 'rollback';
      reason = 'Critical degradation detected after governance evaluation; rollback recommended';
    } else if (
      driftStatus === 'drift' ||
      (driftStatus === 'critical' && !allowRollback) ||
      sustainedDriftCount >= sustainedDriftDays ||
      maeChangeRatio >= retrainMaeRatio
    ) {
      decisionType = 'retrain';
      reason = 'Sustained drift/performance degradation exceeds retraining thresholds';
    } else if (driftStatus === 'watch' || maeChangeRatio > 0) {
      decisionType = 'watch';
      reason = 'Mild degradation detected; monitor before intervention';
    } else {
      decisionType = 'keep';
      reason = 'Model health is stable within acceptable drift and quality thresholds';
    }

    const severityScore =
      (driftStatus === 'critical' ? 1 : driftStatus === 'drift' ? 0.7 : driftStatus === 'watch' ? 0.4 : 0.15) +
      Math.max(0, maeChangeRatio) +
      Math.min(0.4, sustainedDriftCount * 0.1);
    const confidenceScore = clamp01(0.45 + severityScore / 2);

    return {
      decisionType,
      reason,
      confidenceScore,
      evidence: {
        drift_status: driftStatus,
        drift_trend: input.driftTrend,
        recent_samples: input.recentSamples,
        baseline_samples: input.baselineSamples,
        quality_trend: input.qualityTrend,
        thresholds: {
          sustained_drift_days: sustainedDriftDays,
          rollback_critical_ratio: rollbackCriticalRatio,
          retrain_mae_ratio: retrainMaeRatio,
          minimum_samples: minimumSamples,
          allow_rollback: allowRollback,
        },
      },
      modelVersionFrom: input.modelVersionFrom ?? null,
      modelVersionTo: input.modelVersionTo ?? null,
    };
  }

  static async persistDecision(input: PersistDecisionInput): Promise<number> {
    const result = await pool.query(
      `
        INSERT INTO ml_operational_decisions (
          decision_type, reason, confidence_score, inputs_json,
          executed, model_version_from, model_version_to
        )
        VALUES ($1, $2, $3, $4::jsonb, false, $5, $6)
        RETURNING id
      `,
      [
        input.decisionType,
        input.reason,
        input.confidenceScore,
        JSON.stringify(input.inputs ?? {}),
        input.modelVersionFrom ?? null,
        input.modelVersionTo ?? null,
      ]
    );

    const id = Number(result.rows[0]?.id);
    logger.info('RCC operational decision persisted', {
      decision_id: id,
      decision_type: input.decisionType,
      confidence_score: input.confidenceScore,
    });
    return id;
  }

  static async executeDecision(params: {
    decisionId?: number;
    decisionType?: OperationalDecisionType;
    modelVersion?: string;
    force?: boolean;
  }): Promise<{ executed: boolean; action: string; decisionId: number | null; details: Record<string, unknown> }> {
    const allowExecution = envFlag('ML_RCC_ALLOW_DECISION_EXECUTION', false);
    if (!allowExecution && !params.force) {
      return {
        executed: false,
        action: 'blocked_by_policy',
        decisionId: params.decisionId ?? null,
        details: { message: 'Execution policy disabled (set ML_RCC_ALLOW_DECISION_EXECUTION=true or use force)' },
      };
    }

    let row:
      | {
          id: string;
          decision_type: OperationalDecisionType;
          executed: boolean;
          model_version_to: string | null;
        }
      | undefined;

    if (params.decisionId !== undefined) {
      const decisionRes = await pool.query(
        `
          SELECT id, decision_type, executed, model_version_to
          FROM ml_operational_decisions
          WHERE id = $1
          LIMIT 1
        `,
        [params.decisionId]
      );
      row = decisionRes.rows[0];
      if (!row) {
        return {
          executed: false,
          action: 'decision_not_found',
          decisionId: params.decisionId,
          details: {},
        };
      }
      if (row.executed && !params.force) {
        return {
          executed: false,
          action: 'already_executed',
          decisionId: Number(row.id),
          details: {},
        };
      }
    }

    const decisionType = params.decisionType ?? row?.decision_type;
    if (!decisionType) {
      return {
        executed: false,
        action: 'missing_decision_type',
        decisionId: params.decisionId ?? null,
        details: {},
      };
    }

    let action = 'noop';
    const details: Record<string, unknown> = {};
    const decisionId = row ? Number(row.id) : params.decisionId ?? null;

    if (decisionType === 'keep' || decisionType === 'watch') {
      action = `no_op_${decisionType}`;
    } else if (decisionType === 'retrain') {
      const job = await dataCollectionQueue.add(
        JobTypes.RETRAIN_MODEL,
        {
          type: JobTypes.RETRAIN_MODEL,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `rcc-retrain-${Date.now()}`,
          priority: 5,
          attempts: 2,
        }
      );
      action = 'queued_retrain';
      details.job_id = job.id ?? null;
    } else if (decisionType === 'rollback') {
      const version = params.modelVersion ?? row?.model_version_to;
      if (!version) {
        return {
          executed: false,
          action: 'missing_rollback_version',
          decisionId,
          details: {},
        };
      }

      const rollback = await MLPredictionService.rollbackModel(version);
      if (!rollback) {
        return {
          executed: false,
          action: 'rollback_failed',
          decisionId,
          details: { version },
        };
      }
      action = 'rollback_executed';
      details.version = version;
      details.result = rollback;
    }

    if (decisionId !== null) {
      await pool.query(
        `
          UPDATE ml_operational_decisions
          SET executed = true, executed_at = NOW()
          WHERE id = $1
        `,
        [decisionId]
      );
    }

    logger.info('RCC operational decision executed', {
      decision_id: decisionId,
      decision_type: decisionType,
      action,
    });

    return {
      executed: true,
      action,
      decisionId,
      details,
    };
  }
}
