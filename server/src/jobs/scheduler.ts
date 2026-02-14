import { logger } from '@/utils/logger.js';
import { dataCollectionQueue, JobTypes } from './queues.js';

/**
 * Schedule recurring jobs
 */
export class JobScheduler {
  private static intervals: NodeJS.Timeout[] = [];

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

    this.intervals.push(collectionInterval);
    this.intervals.push(alertInterval);

    // Run immediately on startup
    await this.scheduleDataCollection();
    await this.scheduleAlertDetection();

    logger.info('Job scheduler started - data collection every 5 minutes, alerts every 2 minutes');
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
