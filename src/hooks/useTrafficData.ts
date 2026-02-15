"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSocketIO } from './useSocketIO';

export interface TrafficRoad {
  id: number;
  name: string;
  congestion_level: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
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

  const fetchTrafficData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const response = await fetch(`${apiUrl}/traffic/realtime`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setRoads(data.data);
      }

      // Fetch summary
      const summaryResponse = await fetch(`${apiUrl}/traffic/summary`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.success && summaryData.data) {
          setSummary(summaryData.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch traffic data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch initial data
    fetchTrafficData();
  }, [fetchTrafficData]);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to traffic updates
    subscribe('traffic');

    // Handle traffic updates via WebSocket
    const handleTrafficUpdate = (data: TrafficUpdate) => {
      console.log('🚗 Traffic update received:', data);

      if (data.roads) {
        setRoads(data.roads);
      }

      if (data.summary) {
        setSummary(data.summary);
      }
    };

    socket.on('traffic:update', handleTrafficUpdate);

    return () => {
      socket.off('traffic:update', handleTrafficUpdate);
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
