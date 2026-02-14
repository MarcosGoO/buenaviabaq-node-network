import { redis } from '@/lib/redis.js';
import { logger } from '@/utils/logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key prefix
}

export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly NAMESPACE_SEPARATOR = ':';

  /**
   * Build cache key with namespace
   */
  private static buildKey(key: string, namespace?: string): string {
    return namespace
      ? `${namespace}${this.NAMESPACE_SEPARATOR}${key}`
      : key;
  }

  /**
   * Get value from cache
   */
  static async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const cached = await redis.get(fullKey);

      if (!cached) {
        logger.debug(`Cache miss for key: ${fullKey}`);
        return null;
      }

      logger.debug(`Cache hit for key: ${fullKey}`);
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const ttl = options.ttl || this.DEFAULT_TTL;
      const serialized = JSON.stringify(value);

      await redis.setex(fullKey, ttl, serialized);
      logger.debug(`Cache set for key: ${fullKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  static async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await redis.del(fullKey);
      logger.debug(`Cache delete for key: ${fullKey}`);
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  static async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute callback and cache result
   */
  static async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Execute callback to get fresh data
    const data = await callback();

    // Cache the result
    await this.set(key, data, options);

    return data;
  }

  /**
   * Invalidate all keys in a namespace
   */
  static async invalidateNamespace(namespace: string): Promise<number> {
    try {
      const pattern = `${namespace}${this.NAMESPACE_SEPARATOR}*`;
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await redis.del(...keys);
      logger.info(`Invalidated ${result} keys in namespace: ${namespace}`);
      return result;
    } catch (error) {
      logger.error(`Cache invalidate namespace error for ${namespace}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL for a key
   */
  static async getTTL(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      return await redis.ttl(fullKey);
    } catch (error) {
      logger.error(`Cache getTTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Increment a counter in cache
   */
  static async increment(
    key: string,
    options: CacheOptions = {}
  ): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const value = await redis.incr(fullKey);

      // Set TTL if it doesn't exist
      const ttl = await redis.ttl(fullKey);
      if (ttl === -1) {
        await redis.expire(fullKey, options.ttl || this.DEFAULT_TTL);
      }

      return value;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Cache namespaces for organization
   */
  static readonly Namespaces = {
    TRAFFIC: 'traffic',
    WEATHER: 'weather',
    EVENTS: 'events',
    ANALYTICS: 'analytics',
    GEO: 'geo',
    PREDICTIONS: 'predictions',
  } as const;

  /**
   * Cache TTL presets
   */
  static readonly TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 900, // 15 minutes
    HOUR: 3600, // 1 hour
    DAY: 86400, // 24 hours
  } as const;
}
