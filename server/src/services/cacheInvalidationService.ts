import { CacheService } from '@/services/cacheService.js';

/**
 * Cross-namespace invalidation rules
 */
export class CacheInvalidationService {
  static async invalidateTrafficRelatedCaches() {
    await CacheService.invalidateNamespace(CacheService.Namespaces.TRAFFIC);
    await CacheService.invalidateNamespace(CacheService.Namespaces.ROUTES);
  }
}

