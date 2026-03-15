"use client";

import { useState, useEffect } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useZonesData } from '@/hooks/useZonesData';

interface TrafficLayerProps {
  simulatedHour?: number | null;
  visible?: boolean;
}

// Congestion level → fill color
const CONGESTION_COLORS: Record<string, string> = {
  low: '#22c55e',      // green
  moderate: '#eab308', // yellow
  high: '#f97316',     // orange
  severe: '#ef4444',   // red
};

// Congestion level → fill opacity
const CONGESTION_OPACITY: Record<string, number> = {
  low: 0.20,
  moderate: 0.30,
  high: 0.40,
  severe: 0.50,
};

const DEFAULT_COLOR = '#3b82f6';
const DEFAULT_OPACITY = 0.10;

interface HourlyPattern {
  hour: number;
  avg_speed: number;
  congestion_level: string;
}

function speedToCongestion(avgSpeed: number): string {
  if (avgSpeed >= 50) return 'low';
  if (avgSpeed >= 35) return 'moderate';
  if (avgSpeed >= 20) return 'high';
  return 'severe';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function TrafficLayer({ simulatedHour, visible = true }: TrafficLayerProps) {
  const { zones, isLoading } = useZonesData();
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern | null>(null);

  // Fetch historical pattern when simulatedHour is set
  useEffect(() => {
    if (simulatedHour === null || simulatedHour === undefined) return;

    const controller = new AbortController();
    fetch(`${API_URL}/analytics/hourly-pattern?hour=${simulatedHour}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        // Endpoint may return array or single entry
        const pattern = Array.isArray(data.data)
          ? data.data.find((p: HourlyPattern) => p.hour === simulatedHour) ?? data.data[0]
          : data.data;
        setHourlyPattern(pattern ?? null);
      })
      .catch(() => { /* ignore abort */ });

    return () => controller.abort();
  }, [simulatedHour]);

  if (!visible || isLoading || zones.length === 0) return null;

  // In simulation mode, apply the hourly pattern's congestion to all zones
  const getZoneCongestion = (zoneCongestion?: string): string => {
    if (simulatedHour !== null && simulatedHour !== undefined
        && hourlyPattern && hourlyPattern.hour === simulatedHour) {
      return hourlyPattern.congestion_level || speedToCongestion(hourlyPattern.avg_speed);
    }
    return zoneCongestion ?? 'low';
  };

  // Build GeoJSON with congestion properties for data-driven styling
  const zonesGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: zones.map(zone => ({
      type: 'Feature' as const,
      properties: {
        id: zone.id,
        name: zone.name,
        congestion_level: getZoneCongestion(zone.congestion_level),
        avg_speed: zone.avg_speed ?? null,
      },
      geometry: zone.geometry as GeoJSON.Geometry,
    })),
  };

  return (
    <Source id="zones-source" type="geojson" data={zonesGeoJSON}>
      {/* Fill layer — color driven by congestion_level */}
      <Layer
        id="zones-fill"
        type="fill"
        paint={{
          'fill-color': [
            'match',
            ['get', 'congestion_level'],
            'low',      CONGESTION_COLORS.low,
            'moderate', CONGESTION_COLORS.moderate,
            'high',     CONGESTION_COLORS.high,
            'severe',   CONGESTION_COLORS.severe,
            DEFAULT_COLOR,
          ],
          'fill-opacity': [
            'match',
            ['get', 'congestion_level'],
            'low',      CONGESTION_OPACITY.low,
            'moderate', CONGESTION_OPACITY.moderate,
            'high',     CONGESTION_OPACITY.high,
            'severe',   CONGESTION_OPACITY.severe,
            DEFAULT_OPACITY,
          ],
        }}
      />

      {/* Outline layer — matches fill color */}
      <Layer
        id="zones-outline"
        type="line"
        paint={{
          'line-color': [
            'match',
            ['get', 'congestion_level'],
            'low',      CONGESTION_COLORS.low,
            'moderate', CONGESTION_COLORS.moderate,
            'high',     CONGESTION_COLORS.high,
            'severe',   CONGESTION_COLORS.severe,
            DEFAULT_COLOR,
          ],
          'line-width': 2,
          'line-opacity': 0.7,
        }}
      />

      {/* Zone name labels */}
      <Layer
        id="zones-labels-layer"
        type="symbol"
        layout={{
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-offset': [0, 0],
        }}
        paint={{
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        }}
      />
    </Source>
  );
}
