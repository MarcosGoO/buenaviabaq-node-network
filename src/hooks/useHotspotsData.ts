"use client";

import { useCallback, useEffect, useState } from "react";

export interface Hotspot {
  road_id: number;
  road_name: string;
  congestion_frequency: number;
  avg_speed: number;
  peak_hour: number;
  total_incidents: number;
}

interface UseHotspotsDataReturn {
  hotspots: Hotspot[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function useHotspotsData(limit: number = 12): UseHotspotsDataReturn {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHotspots = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/analytics/hotspots?limit=${limit}&days=14`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload = (await response.json()) as {
        status?: string;
        success?: boolean;
        data?: Hotspot[];
      };

      if ((payload.status === "success" || payload.success) && Array.isArray(payload.data)) {
        setHotspots(payload.data);
      } else {
        setHotspots([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHotspots();
    const interval = setInterval(fetchHotspots, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHotspots]);

  return {
    hotspots,
    isLoading,
    error,
    refresh: fetchHotspots,
  };
}

