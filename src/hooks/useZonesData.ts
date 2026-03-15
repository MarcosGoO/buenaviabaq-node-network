"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface Zone {
  id: number;
  name: string;
  metadata?: {
    source?: string;
    source_id?: string | number | null;
    dataset_version?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  congestion_level?: "low" | "moderate" | "high" | "severe";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function useZonesData(): UseZonesDataReturn {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cooldownUntilRef = useRef(0);

  const fetchZones = useCallback(async () => {
    if (Date.now() < cooldownUntilRef.current) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      setIsLoading(true);
      setError(null);

      const [geoRes, insightsRes] = await Promise.all([
        fetch(`${API_URL}/geo/zones`, { signal }),
        fetch(`${API_URL}/insights/zones`, { signal }).catch(() => null),
      ]);

      if (!geoRes.ok) {
        if (geoRes.status === 429) {
          cooldownUntilRef.current = Date.now() + 60_000;
          setError("Rate limited - retrying soon");
          return;
        }
        throw new Error(`HTTP error! status: ${geoRes.status}`);
      }

      const geoContentType = geoRes.headers.get("content-type") ?? "";
      if (!geoContentType.includes("application/json")) {
        setError("Unexpected zones response format");
        return;
      }

      const geoData = (await geoRes.json()) as { success?: boolean; status?: string; data?: Zone[] };
      if (!((geoData.success || geoData.status === "success") && Array.isArray(geoData.data))) {
        return;
      }

      const baseZones = geoData.data;

      if (insightsRes?.ok) {
        const insightsContentType = insightsRes.headers.get("content-type") ?? "";
        if (!insightsContentType.includes("application/json")) {
          setZones(baseZones);
          return;
        }

        const insightsData = (await insightsRes.json()) as {
          data?: Array<{
            zone_id: number;
            congestion_level: string;
            avg_speed: number;
            active_alerts: number;
            arroyo_risk_level: string | null;
          }>;
        };

        if (Array.isArray(insightsData.data)) {
          const insightsMap = new Map(insightsData.data.map((item) => [item.zone_id, item]));
          setZones(
            baseZones.map((zone) => {
              const insight = insightsMap.get(zone.id);
              if (!insight) return zone;
              return {
                ...zone,
                congestion_level: insight.congestion_level as Zone["congestion_level"],
                avg_speed: insight.avg_speed,
                active_alerts: insight.active_alerts,
                arroyo_risk_level: insight.arroyo_risk_level,
              };
            })
          );
          return;
        }
      }

      setZones(baseZones);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
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
