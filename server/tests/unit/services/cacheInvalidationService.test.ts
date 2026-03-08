import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/cacheService.js', () => ({
  CacheService: {
    Namespaces: { TRAFFIC: 'traffic', ROUTES: 'routes' },
    invalidateNamespace: vi.fn().mockResolvedValue(1),
  },
}));

import { CacheService } from '@/services/cacheService.js';
import { CacheInvalidationService } from '@/services/cacheInvalidationService.js';

describe('CacheInvalidationService', () => {
  it('invalidates traffic and routes namespaces in cascade', async () => {
    await CacheInvalidationService.invalidateTrafficRelatedCaches();

    expect(CacheService.invalidateNamespace).toHaveBeenNthCalledWith(1, 'traffic');
    expect(CacheService.invalidateNamespace).toHaveBeenNthCalledWith(2, 'routes');
  });
});

