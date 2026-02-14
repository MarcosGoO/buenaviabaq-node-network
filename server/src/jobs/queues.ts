import { Queue, QueueEvents } from 'bullmq';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

const connection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
};

// Queue for data collection jobs
export const dataCollectionQueue = new Queue('data-collection', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

// Queue events for monitoring
export const dataCollectionEvents = new QueueEvents('data-collection', {
  connection,
});

// Event listeners for queue monitoring
dataCollectionEvents.on('completed', ({ jobId }) => {
  logger.info(`Job ${jobId} completed successfully`);
});

dataCollectionEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed:`, failedReason);
});

dataCollectionEvents.on('stalled', ({ jobId }) => {
  logger.warn(`Job ${jobId} stalled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing queues...');
  await dataCollectionQueue.close();
  await dataCollectionEvents.close();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing queues...');
  await dataCollectionQueue.close();
  await dataCollectionEvents.close();
});

export const JobTypes = {
  COLLECT_TRAFFIC: 'collect-traffic',
  COLLECT_WEATHER: 'collect-weather',
  COLLECT_ALL: 'collect-all',
  DETECT_ALERTS: 'detect-alerts',
} as const;

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];
