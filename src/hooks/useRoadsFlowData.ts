"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RoadFlow {
  id: number;
  name: string;
  road_type: string;
  geometry: GeoJSON.LineString;
  congestion_level: "low" | "moderate" | "high" | "severe";
  speed_kmh: number;
  travel_time_minutes: number;
  zone_id: number | null;
  last_updated: string;
}

interface UseRoadsFlowDataReturn {
  roads: RoadFlow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function useRoadsFlowData(): UseRoadsFlowDataReturn {
  const [roads, setRoads] = useState<RoadFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRoads = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/geo/roads/flow?verified=true`, { signal });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload = (await response.json()) as {
        status?: string;
        success?: boolean;
        data?: RoadFlow[];
      };

      if ((payload.status === "success" || payload.success) && Array.isArray(payload.data)) {
        setRoads(payload.data);
      } else {
        setRoads([]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoads();
    const interval = setInterval(fetchRoads, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRoads]);

  return {
    roads,
    isLoading,
    error,
    refresh: fetchRoads,
  };
}
