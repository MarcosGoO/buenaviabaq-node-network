"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocketIO } from "./useSocketIO";

export interface TrafficRoad {
  id: number;
  name: string;
  congestion_level: "free" | "light" | "moderate" | "heavy" | "severe";
  speed_kmh: number;
  travel_time_minutes: number;
}

export interface TrafficSummary {
  average_speed: number;
  total_roads: number;
  congested_roads: number;
  free_flow_roads: number;
}

interface TrafficUpdate {
  roads: TrafficRoad[];
  summary: TrafficSummary;
}

interface UseTrafficDataReturn {
  roads: TrafficRoad[];
  summary: TrafficSummary | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTrafficData(): UseTrafficDataReturn {
  const { socket, isConnected, subscribe } = useSocketIO();
  const [roads, setRoads] = useState<TrafficRoad[]>([]);
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cooldownUntilRef = useRef(0);

  const fetchTrafficData = useCallback(async () => {
    if (Date.now() < cooldownUntilRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const [roadsRes, summaryRes] = await Promise.all([
        fetch(`${apiUrl}/traffic/realtime`),
        fetch(`${apiUrl}/traffic/summary`),
      ]);

      if (!roadsRes.ok) {
        if (roadsRes.status === 429) {
          cooldownUntilRef.current = Date.now() + 60_000;
          setError("Rate limited - retrying soon");
          return;
        }
        throw new Error(`HTTP error! status: ${roadsRes.status}`);
      }

      const roadsContentType = roadsRes.headers.get("content-type") ?? "";
      if (roadsContentType.includes("application/json")) {
        const roadsData = (await roadsRes.json()) as { success?: boolean; status?: string; data?: TrafficRoad[] };
        if ((roadsData.success || roadsData.status === "success") && Array.isArray(roadsData.data)) {
          setRoads(roadsData.data);
        }
      }

      if (summaryRes.ok) {
        const summaryContentType = summaryRes.headers.get("content-type") ?? "";
        if (summaryContentType.includes("application/json")) {
          const summaryData = (await summaryRes.json()) as {
            success?: boolean;
            status?: string;
            data?: TrafficSummary;
          };
          if ((summaryData.success || summaryData.status === "success") && summaryData.data) {
            setSummary(summaryData.data);
          }
        }
      } else if (summaryRes.status === 429) {
        cooldownUntilRef.current = Date.now() + 60_000;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrafficData();
  }, [fetchTrafficData]);

  useEffect(() => {
    if (!socket) return;

    subscribe("traffic");

    const handleTrafficUpdate = (data: TrafficUpdate) => {
      if (Array.isArray(data.roads)) {
        setRoads(data.roads);
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    };

    socket.on("traffic:update", handleTrafficUpdate);
    return () => {
      socket.off("traffic:update", handleTrafficUpdate);
    };
  }, [socket, subscribe]);

  return {
    roads,
    summary,
    isConnected,
    isLoading,
    error,
    refresh: fetchTrafficData,
  };
}
