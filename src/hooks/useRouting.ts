"use client";

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface RouteCoord {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  avoid_arroyos: boolean;
  avoid_congestion: boolean;
  avoid_events: boolean;
  max_routes: number;
}

export interface RouteSegment {
  road_id: number;
  road_name: string;
  road_type: string;
  distance_km: number;
  estimated_time_minutes: number;
  current_speed_kmh: number;
  congestion_level: string;
  traffic_source?: 'historical' | 'mock' | 'tomtom';
  live_data?: boolean;
  road_closure?: boolean;
  traffic_confidence?: number | null;
  traffic_updated_at?: string | null;
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

export interface Route {
  route_id: string;
  segments: RouteSegment[];
  total_distance_km: number;
  estimated_time_minutes: number;
  average_speed_kmh: number;
  overall_score: number;
  score_breakdown: {
    traffic_score: number;
    weather_score: number;
    safety_score: number;
    distance_score: number;
  };
  warnings: string[];
  metadata: {
    total_roads: number;
    congested_segments: number;
    weather_affected: boolean;
    arroyo_risk: boolean;
    event_nearby: boolean;
    strategy?: 'balanced' | 'fastest' | 'resilient' | 'shortest' | 'low-risk';
    strategy_label?: string;
    live_traffic?: boolean;
    traffic_source?: 'historical' | 'mock' | 'tomtom';
    closure_segments?: number;
    low_confidence_segments?: number;
    provider_mode?: 'mock' | 'tomtom';
    live_reason?: string;
    last_live_update?: string | null;
  };
}

interface UseRoutingReturn {
  routes: Route[];
  selectedRoute: Route | null;
  isLoading: boolean;
  error: string | null;
  calculateRoutes: (origin: RouteCoord, destination: RouteCoord, prefs?: Partial<RoutePreferences>) => Promise<void>;
  selectRoute: (route: Route) => void;
  clearRoutes: () => void;
}

export function useRouting(): UseRoutingReturn {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoutes = useCallback(async (
    origin: RouteCoord,
    destination: RouteCoord,
    prefs?: Partial<RoutePreferences>
  ) => {
    setIsLoading(true);
    setError(null);
    setRoutes([]);
    setSelectedRoute(null);

    try {
      const response = await fetch(`${API_URL}/routes/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          preferences: {
            avoid_arroyos: prefs?.avoid_arroyos ?? false,
            avoid_congestion: prefs?.avoid_congestion ?? true,
            avoid_events: prefs?.avoid_events ?? false,
            max_routes: prefs?.max_routes ?? 3,
          },
        }),
      });
      const contentType = response.headers.get('content-type') ?? '';
      let data: unknown = null;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(bodyText || `Error ${response.status}`);
        }
      }

      if (!response.ok) {
        const message =
          typeof data === 'object' &&
          data !== null &&
          'message' in data &&
          typeof (data as { message?: unknown }).message === 'string'
            ? (data as { message: string }).message
            : `Error ${response.status}`;
        throw new Error(message);
      }

      const payload =
        typeof data === 'object' && data !== null
          ? (data as { success?: boolean; status?: string; data?: Route[] })
          : null;

      if (payload && (payload.success || payload.status === 'success') && Array.isArray(payload.data)) {
        setRoutes(payload.data);
        // Auto-select the best route (first = highest score)
        setSelectedRoute(payload.data[0] ?? null);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error calculating routes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectRoute = useCallback((route: Route) => {
    setSelectedRoute(route);
  }, []);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
    setSelectedRoute(null);
    setError(null);
  }, []);

  return { routes, selectedRoute, isLoading, error, calculateRoutes, selectRoute, clearRoutes };
}
