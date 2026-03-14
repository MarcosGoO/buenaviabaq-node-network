import { logger } from '@/utils/logger.js';
import { dataCollectionQueue, JobTypes } from './queues.js';
import { ModelReliabilityService } from '@/services/modelReliabilityService.js';
import { ModelGovernanceService } from '@/services/modelGovernanceService.js';
import { SocketService } from '@/lib/socket.js';

/**
 * Schedule recurring jobs
 */
export class JobScheduler {
  private static intervals: NodeJS.Timeout[] = [];
  private static lastDriftAlertStatus: 'drift' | 'critical' | null = null;

  /**
   * Start all scheduled jobs
   */
  static async start(): Promise<void> {
    logger.info('Starting job scheduler...');

    // Schedule full data collection every 5 minutes
    const collectionInterval = setInterval(async () => {
      try {
        await this.scheduleDataCollection();
      } catch (error) {
        logger.error('Error scheduling data collection:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Schedule alert detection every 2 minutes
    const alertInterval = setInterval(async () => {
      try {
        await this.scheduleAlertDetection();
      } catch (error) {
        logger.error('Error scheduling alert detection:', error);
      }
    }, 2 * 60 * 1000); // 2 minutes

    // Schedule prediction feedback sync + drift monitor every 15 minutes
    const driftMonitorInterval = setInterval(async () => {
      try {
        await this.monitorPredictionDrift();
      } catch (error) {
        logger.error('Error monitoring prediction drift:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    this.intervals.push(collectionInterval);
    this.intervals.push(alertInterval);
    this.intervals.push(driftMonitorInterval);

    // Schedule daily ML quality materialization at 00:10 local time
    this.scheduleDailyQualityMaterialization();

    // Schedule weekly model retraining (Sunday at 3:00 AM)
    this.scheduleWeeklyRetraining();

    // Run immediately on startup
    await this.scheduleDataCollection();
    await this.scheduleAlertDetection();
    await this.monitorPredictionDrift();
    await this.materializeDailyQuality();

    logger.info('Job scheduler started - data collection every 5 minutes, alerts every 2 minutes, drift monitor every 15 minutes, reliability daily quality at 00:10, model retraining weekly on Sunday 3:00 AM');
  }

  /**
   * Schedule a data collection job
   */
  static async scheduleDataCollection(): Promise<void> {
    try {
      const job = await dataCollectionQueue.add(
        JobTypes.COLLECT_ALL,
        {
          type: JobTypes.COLLECT_ALL,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `collect-all-${Date.now()}`,
          priority: 1,
        }
      );

      logger.info(`Scheduled data collection job: ${job.id}`);
    } catch (error) {
      logger.error('Failed to schedule data collection:', error);
      throw error;
    }
  }

  /**
   * Schedule a traffic collection job
   */
  static async scheduleTrafficCollection(): Promise<void> {
    try {
      const job = await dataCollectionQueue.add(
        JobTypes.COLLECT_TRAFFIC,
        {
          type: JobTypes.COLLECT_TRAFFIC,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `collect-traffic-${Date.now()}`,
          priority: 2,
        }
      );

      logger.info(`Scheduled traffic collection job: ${job.id}`);
    } catch (error) {
      logger.error('Failed to schedule traffic collection:', error);
      throw error;
    }
  }

  /**
   * Schedule a weather collection job
   */
  static async scheduleWeatherCollection(): Promise<void> {
    try {
      const job = await dataCollectionQueue.add(
        JobTypes.COLLECT_WEATHER,
        {
          type: JobTypes.COLLECT_WEATHER,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `collect-weather-${Date.now()}`,
          priority: 3,
        }
      );

      logger.info(`Scheduled weather collection job: ${job.id}`);
    } catch (error) {
      logger.error('Failed to schedule weather collection:', error);
      throw error;
    }
  }

  /**
   * Schedule an alert detection job
   */
  static async scheduleAlertDetection(): Promise<void> {
    try {
      const job = await dataCollectionQueue.add(
        JobTypes.DETECT_ALERTS,
        {
          type: JobTypes.DETECT_ALERTS,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `detect-alerts-${Date.now()}`,
          priority: 2, // High priority for alerts
        }
      );

      logger.info(`Scheduled alert detection job: ${job.id}`);
    } catch (error) {
      logger.error('Failed to schedule alert detection:', error);
      throw error;
    }
  }

  /**
   * Schedule model retraining at Sunday 3:00 AM
   * Uses setTimeout chain to fire precisely at the next Sunday 3 AM, then repeats weekly.
   */
  static scheduleWeeklyRetraining(): void {
    const scheduleNext = () => {
      const msUntilNextSunday3AM = this.msUntilNextSunday3AM();
      logger.info(`Weekly model retraining scheduled in ${Math.round(msUntilNextSunday3AM / 3600_000)}h`);

      const timeout = setTimeout(async () => {
        try {
          const governanceInput = await ModelGovernanceService.buildGovernanceInput(30);
          const decision = ModelGovernanceService.evaluateOperationalDecision(governanceInput);
          const decisionId = await ModelGovernanceService.persistDecision({
            decisionType: decision.decisionType,
            reason: `[weekly_precheck] ${decision.reason}`,
            confidenceScore: decision.confidenceScore,
            inputs: decision.evidence,
            modelVersionFrom: decision.modelVersionFrom,
            modelVersionTo: decision.modelVersionTo,
          });

          if (decision.decisionType === 'retrain') {
            await this.scheduleModelRetraining();
            logger.info('Weekly retraining authorized by governance pre-check', { decision_id: decisionId });
          } else {
            logger.info('Weekly retraining skipped by governance pre-check', {
              decision_id: decisionId,
              decision_type: decision.decisionType,
            });
          }
        } catch (error) {
          logger.error('Error scheduling model retraining:', error);
        }
        // Schedule the next occurrence
        scheduleNext();
      }, msUntilNextSunday3AM);

      this.intervals.push(timeout as unknown as NodeJS.Timeout);
    };

    scheduleNext();
  }

  /**
   * Calculate milliseconds until next Sunday at 03:00 AM local time
   */
  private static msUntilNextSunday3AM(): number {
    const now = new Date();
    const next = new Date(now);

    // Set to 3:00 AM
    next.setHours(3, 0, 0, 0);

    // Advance to next Sunday (day 0)
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilSunday);

    // If we calculated a time in the past (edge case), add 7 days
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 7);
    }

    return next.getTime() - now.getTime();
  }

  /**
   * Enqueue a model retraining job immediately
   */
  static async scheduleModelRetraining(): Promise<string> {
    try {
      const job = await dataCollectionQueue.add(
        JobTypes.RETRAIN_MODEL,
        {
          type: JobTypes.RETRAIN_MODEL,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: `retrain-model-${Date.now()}`,
          priority: 5, // Lower priority than real-time data collection
          attempts: 2,
        }
      );

      logger.info(`Scheduled model retraining job: ${job.id}`);
      return job.id ?? '';
    } catch (error) {
      logger.error('Failed to schedule model retraining:', error);
      throw error;
    }
  }

  /**
   * Sync observed values and monitor short-term model drift.
   */
  static async monitorPredictionDrift(): Promise<void> {
    const reliability = await ModelReliabilityService.runReliabilityCheckNow({
      lookbackHours: 72,
      toleranceMinutes: 30,
      recentHours: 24,
      baselineDays: 30,
      minSamples: 40,
      governanceDays: 30,
    });
    const drift = reliability.drift;
    const sync = reliability.sync;

    const payload = {
      status: drift.status,
      max_change_ratio: drift.deltas.max_change_ratio,
      recent_samples: drift.recent.samples,
      baseline_samples: drift.baseline.samples,
      synced_rows: sync.updated,
    };

    if (drift.status === 'critical' || drift.status === 'drift') {
      if (this.lastDriftAlertStatus !== drift.status) {
        SocketService.emitAlertNotification({
          type: 'model:drift',
          severity: drift.status === 'critical' ? 'critical' : 'high',
          drift_status: drift.status,
          max_change_ratio: drift.deltas.max_change_ratio,
          recent_samples: drift.recent.samples,
          baseline_samples: drift.baseline.samples,
          synced_rows: sync.updated,
          timestamp: new Date().toISOString(),
        });
      }
      this.lastDriftAlertStatus = drift.status;
      logger.warn('Model drift monitor detected degradation', payload);
      return;
    }

    if (this.lastDriftAlertStatus !== null) {
      SocketService.emitAlertNotification({
        type: 'model:drift_recovered',
        severity: 'medium',
        previous_status: this.lastDriftAlertStatus,
        current_status: drift.status,
        max_change_ratio: drift.deltas.max_change_ratio,
        recent_samples: drift.recent.samples,
        baseline_samples: drift.baseline.samples,
        synced_rows: sync.updated,
        timestamp: new Date().toISOString(),
      });
      this.lastDriftAlertStatus = null;
    }

    logger.info('Model drift monitor snapshot', payload);
  }

  /**
   * Schedule daily quality materialization at 00:10 AM local time.
   */
  static scheduleDailyQualityMaterialization(): void {
    const scheduleNext = () => {
      const msUntilNextDaily = this.msUntilNextDaily0010();
      logger.info(`Daily reliability quality materialization scheduled in ${Math.round(msUntilNextDaily / 60_000)}m`);

      const timeout = setTimeout(async () => {
        try {
          await this.materializeDailyQuality();
        } catch (error) {
          logger.error('Error running daily quality materialization:', error);
        }
        scheduleNext();
      }, msUntilNextDaily);

      this.intervals.push(timeout as unknown as NodeJS.Timeout);
    };

    scheduleNext();
  }

  private static msUntilNextDaily0010(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(0, 10, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  static async materializeDailyQuality(day?: string): Promise<void> {
    await ModelReliabilityService.materializeDailyQuality(day);
  }

  /**
   * Stop all scheduled jobs
   */
  static stop(): void {
    logger.info('Stopping job scheduler...');

    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });

    this.intervals = [];

    logger.info('Job scheduler stopped');
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        dataCollectionQueue.getWaitingCount(),
        dataCollectionQueue.getActiveCount(),
        dataCollectionQueue.getCompletedCount(),
        dataCollectionQueue.getFailedCount(),
        dataCollectionQueue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  JobScheduler.stop();
});

process.on('SIGINT', () => {
  JobScheduler.stop();
});
