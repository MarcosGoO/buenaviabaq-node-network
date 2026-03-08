import { CacheService } from '@/services/cacheService.js';
import { InsightsService, type ExecutiveSummary } from '@/services/insightsService.js';
import { logger } from '@/utils/logger.js';

export class CacheWarmupService {
  static async warmInsightsSummaryCache(): Promise<void> {
    const cacheKey = 'executive-summary';
    const ttl = 300;

    try {
      const cached = await CacheService.get<ExecutiveSummary>(
        cacheKey,
        CacheService.Namespaces.INSIGHTS
      );

      if (cached) {
        logger.info('Insights summary cache already warm');
        return;
      }

      const summary = await InsightsService.getExecutiveSummary();
      await CacheService.set(cacheKey, summary, ttl, CacheService.Namespaces.INSIGHTS);
      logger.info('Insights summary cache warmed successfully');
    } catch (error) {
      logger.warn('Insights cache warmup failed (non-blocking):', error);
    }
  }
}

