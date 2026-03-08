import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/cacheService.js', () => ({
  CacheService: {
    Namespaces: { INSIGHTS: 'insights' },
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/services/insightsService.js', () => ({
  InsightsService: {
    getExecutiveSummary: vi.fn(),
  },
}));

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { CacheService } from '@/services/cacheService.js';
import { InsightsService } from '@/services/insightsService.js';
import { CacheWarmupService } from '@/services/cacheWarmupService.js';

describe('CacheWarmupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips warmup when summary is already cached', async () => {
    vi.mocked(CacheService.get).mockResolvedValue({ already: true } as never);

    await CacheWarmupService.warmInsightsSummaryCache();

    expect(CacheService.get).toHaveBeenCalledWith('executive-summary', 'insights');
    expect(InsightsService.getExecutiveSummary).not.toHaveBeenCalled();
    expect(CacheService.set).not.toHaveBeenCalled();
  });

  it('warms summary cache on miss', async () => {
    const summary = { generated_at: new Date().toISOString() };
    vi.mocked(CacheService.get).mockResolvedValue(null);
    vi.mocked(InsightsService.getExecutiveSummary).mockResolvedValue(summary as never);
    vi.mocked(CacheService.set).mockResolvedValue(true);

    await CacheWarmupService.warmInsightsSummaryCache();

    expect(InsightsService.getExecutiveSummary).toHaveBeenCalledTimes(1);
    expect(CacheService.set).toHaveBeenCalledWith('executive-summary', summary, 300, 'insights');
  });

  it('does not throw when warmup fails', async () => {
    vi.mocked(CacheService.get).mockRejectedValue(new Error('redis unavailable'));

    await expect(CacheWarmupService.warmInsightsSummaryCache()).resolves.toBeUndefined();
  });
});

