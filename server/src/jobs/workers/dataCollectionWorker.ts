import { Worker, Job } from 'bullmq';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import { TrafficHistoryService } from '@/services/trafficHistoryService.js';
import { WeatherHistoryService } from '@/services/weatherHistoryService.js';
import { AlertService } from '@/services/alertService.js';
import { SocketService } from '@/lib/socket.js';
import { CacheService } from '@/services/cacheService.js';
import { JobTypes, type JobType } from '../queues.js';

const connection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
};

interface JobData {
  type: JobType;
  timestamp: string;
}

interface JobResult {
  success: boolean;
  type: JobType;
  timestamp: string;
  recordsProcessed?: number;
  error?: string;
}

/**
 * Process traffic data collection
 */
async function processTrafficCollection(): Promise<JobResult> {
  try {
    logger.info('Starting traffic data collection...');

    // Store traffic snapshot in database
    await TrafficHistoryService.storeTrafficSnapshot();

    // Invalidate traffic cache to force fresh data
    await CacheService.invalidateNamespace(CacheService.Namespaces.TRAFFIC);

    logger.info('Traffic data collection completed successfully');

    return {
      success: true,
      type: JobTypes.COLLECT_TRAFFIC,
      timestamp: new Date().toISOString(),
      recordsProcessed: 6, // Number of roads tracked
    };
  } catch (error) {
    logger.error('Traffic data collection failed:', error);
    throw error;
  }
}

/**
 * Process weather data collection
 */
async function processWeatherCollection(): Promise<JobResult> {
  try {
    logger.info('Starting weather data collection...');

    // Store weather snapshot in database
    await WeatherHistoryService.storeWeatherSnapshot();

    // Invalidate cache to force fresh data on next request
    await CacheService.invalidateNamespace(CacheService.Namespaces.WEATHER);

    logger.info('Weather data collection completed successfully');

    return {
      success: true,
      type: JobTypes.COLLECT_WEATHER,
      timestamp: new Date().toISOString(),
      recordsProcessed: 1,
    };
  } catch (error) {
    logger.error('Weather data collection failed:', error);
    throw error;
  }
}

/**
 * Process alert detection
 */
async function processAlertDetection(): Promise<JobResult> {
  try {
    logger.info('Starting alert detection...');

    // Detect all active alerts
    const allAlerts = await AlertService.detectActiveAlerts();
    const activeAlerts = AlertService.getActiveAlerts(allAlerts);

    // Invalidate alerts cache
    await CacheService.invalidateNamespace(CacheService.Namespaces.ALERTS);

    // Emit alerts via Socket.IO
    if (activeAlerts.length > 0) {
      for (const alert of activeAlerts) {
        SocketService.emitAlertNotification(alert as unknown as Record<string, unknown>);
      }
      logger.info(`Emitted ${activeAlerts.length} alert(s) via Socket.IO`);
    }

    logger.info('Alert detection completed successfully');

    return {
      success: true,
      type: JobTypes.DETECT_ALERTS,
      timestamp: new Date().toISOString(),
      recordsProcessed: activeAlerts.length,
    };
  } catch (error) {
    logger.error('Alert detection failed:', error);
    throw error;
  }
}

/**
 * Process all data collection tasks
 */
async function processAllCollection(): Promise<JobResult> {
  try {
    logger.info('Starting full data collection cycle...');

    // Run both collections in parallel
    const [trafficResult, weatherResult] = await Promise.allSettled([
      processTrafficCollection(),
      processWeatherCollection(),
    ]);

    const totalRecords =
      (trafficResult.status === 'fulfilled' ? trafficResult.value.recordsProcessed || 0 : 0) +
      (weatherResult.status === 'fulfilled' ? weatherResult.value.recordsProcessed || 0 : 0);

    const hasErrors =
      trafficResult.status === 'rejected' || weatherResult.status === 'rejected';

    if (hasErrors) {
      logger.warn('Full data collection completed with some errors');
    } else {
      logger.info('Full data collection completed successfully');
    }

    return {
      success: !hasErrors,
      type: JobTypes.COLLECT_ALL,
      timestamp: new Date().toISOString(),
      recordsProcessed: totalRecords,
    };
  } catch (error) {
    logger.error('Full data collection failed:', error);
    throw error;
  }
}

/**
 * Main worker processor
 */
async function processJob(job: Job<JobData>): Promise<JobResult> {
  logger.info(`Processing job ${job.id} of type: ${job.data.type}`);

  switch (job.data.type) {
    case JobTypes.COLLECT_TRAFFIC:
      return await processTrafficCollection();

    case JobTypes.COLLECT_WEATHER:
      return await processWeatherCollection();

    case JobTypes.COLLECT_ALL:
      return await processAllCollection();

    case JobTypes.DETECT_ALERTS:
      return await processAlertDetection();

    default:
      throw new Error(`Unknown job type: ${job.data.type}`);
  }
}

/**
 * Create and start the worker
 */
export const dataCollectionWorker = new Worker<JobData, JobResult>(
  'data-collection',
  processJob,
  {
    connection,
    concurrency: 1, // Process one job at a time to avoid rate limits
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // Per 60 seconds
    },
  }
);

// Worker event listeners
dataCollectionWorker.on('completed', (job, result) => {
  logger.info(`Worker completed job ${job.id}:`, result);
});

dataCollectionWorker.on('failed', (job, error) => {
  logger.error(`Worker failed job ${job?.id}:`, error);
});

dataCollectionWorker.on('error', (error) => {
  logger.error('Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await dataCollectionWorker.close();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await dataCollectionWorker.close();
});

logger.info('Data collection worker started successfully');
