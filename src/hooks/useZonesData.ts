"use client";

import { useEffect, useState, useCallback, useRef } from 'react';

export interface Zone {
  id: number;
  name: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  congestion_level?: 'low' | 'moderate' | 'high' | 'severe';
  avg_speed?: number;
  active_alerts?: number;
  arroyo_risk_level?: string | null;
}

interface UseZonesDataReturn {
  zones: Zone[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function useZonesData(): UseZonesDataReturn {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchZones = useCallback(async () => {
    // Cancel any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch zones geometry and zone insights in parallel
      const [geoRes, insightsRes] = await Promise.all([
        fetch(`${API_URL}/geo/zones`, { signal }),
        fetch(`${API_URL}/insights/zones`, { signal }).catch(() => null),
      ]);

      if (!geoRes.ok) {
        if (geoRes.status === 429) {
          console.warn('⚠️ Rate limited - zones will load on next retry');
          setError('Rate limited - retrying soon');
          return;
        }
        throw new Error(`HTTP error! status: ${geoRes.status}`);
      }

      const geoData = await geoRes.json();

      if (!((geoData.success || geoData.status === 'success') && geoData.data)) {
        console.warn('⚠️ API response missing data:', geoData);
        return;
      }

      const baseZones: Zone[] = geoData.data;

      // Merge with insights if available
      if (insightsRes?.ok) {
        const insightsData = await insightsRes.json();
        const insights = insightsData.data as Array<{
          zone_id: number;
          congestion_level: string;
          avg_speed: number;
          active_alerts: number;
          arroyo_risk_level: string | null;
        }>;

        if (Array.isArray(insights)) {
          const insightsMap = new Map(insights.map(i => [i.zone_id, i]));
          const merged = baseZones.map(zone => {
            const insight = insightsMap.get(zone.id);
            return insight
              ? {
                  ...zone,
                  congestion_level: insight.congestion_level as Zone['congestion_level'],
                  avg_speed: insight.avg_speed,
                  active_alerts: insight.active_alerts,
                  arroyo_risk_level: insight.arroyo_risk_level,
                }
              : zone;
          });
          setZones(merged);
          return;
        }
      }

      setZones(baseZones);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('❌ Failed to fetch zones:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();

    // Refresh every 5 minutes
    const interval = setInterval(fetchZones, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchZones]);

  return {
    zones,
    isLoading,
    error,
    refresh: fetchZones,
  };
}
