"use client";

import { useEffect } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useZonesData } from '@/hooks/useZonesData';
import { useTrafficData } from '@/hooks/useTrafficData';

export function TrafficLayer() {
  const { zones, isLoading: zonesLoading } = useZonesData();
  const { roads, isLoading: trafficLoading } = useTrafficData();

  useEffect(() => {
    if (!zonesLoading && zones.length > 0) {
      console.log('📍 Loaded zones:', zones.length);
    }
  }, [zones, zonesLoading]);

  useEffect(() => {
    if (!trafficLoading && roads.length > 0) {
      console.log('🚗 Loaded traffic data:', roads.length, 'roads');
    }
  }, [roads, trafficLoading]);

  if (zonesLoading || zones.length === 0) {
    return null;
  }

  // Convert zones to GeoJSON FeatureCollection
  const zonesGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: zones.map(zone => ({
      type: 'Feature',
      properties: {
        id: zone.id,
        name: zone.name,
      },
      geometry: zone.geometry as GeoJSON.Geometry,
    })),
  };

  return (
    <>
      {/* Zones layer - outline */}
      <Source id="zones-source" type="geojson" data={zonesGeoJSON}>
        <Layer
          id="zones-fill"
          type="fill"
          paint={{
            'fill-color': '#3b82f6',
            'fill-opacity': 0.1,
          }}
        />
        <Layer
          id="zones-outline"
          type="line"
          paint={{
            'line-color': '#3b82f6',
            'line-width': 2,
            'line-opacity': 0.6,
          }}
        />
      </Source>

      {/* Zone labels */}
      <Source id="zones-labels" type="geojson" data={zonesGeoJSON}>
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
            'text-color': '#1e40af',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          }}
        />
      </Source>
    </>
  );
}
