import Redis from 'ioredis';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

class RedisClient {
  private static instance: Redis | null = null;
  private static isConnecting = false;

  private constructor() {}

  static getInstance(): Redis {
    if (!this.instance && !this.isConnecting) {
      this.isConnecting = true;

      this.instance = new Redis({
        host: config.REDIS_HOST || 'localhost',
        port: config.REDIS_PORT || 6379,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: true,
        lazyConnect: false,
        // Connection pooling settings
        maxLoadingRetryTime: 5000,
        enableOfflineQueue: true,
      });

      this.instance.on('connect', () => {
        logger.info('Redis client connected successfully');
      });

      this.instance.on('ready', () => {
        logger.info('Redis client ready to accept commands');
        this.isConnecting = false;
      });

      this.instance.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.instance.on('close', () => {
        logger.warn('Redis connection closed');
      });

      this.instance.on('reconnecting', (delay: number) => {
        logger.info(`Redis client reconnecting in ${delay}ms`);
      });
    }

    if (!this.instance) {
      throw new Error('Redis client not initialized');
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      logger.info('Redis client disconnected');
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getInstance();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }
}

export const redis = RedisClient.getInstance();
export { RedisClient };
