"use client";

import { Layer, Source } from "react-map-gl/maplibre";
import { useMemo } from "react";
import { useRoadsFlowData } from "@/hooks/useRoadsFlowData";
import { useHotspotsData } from "@/hooks/useHotspotsData";
import { useMapIncidentsData } from "@/hooks/useMapIncidentsData";

export interface LayerVisibilityState {
  zones: boolean;
  roads: boolean;
  hotspots: boolean;
  arroyos: boolean;
  events: boolean;
}

const CONGESTION_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

function lineMidpoint(line: GeoJSON.LineString): [number, number] {
  const coords = line.coordinates ?? [];
  if (coords.length === 0) return [-74.7964, 10.9639];
  if (coords.length === 1) return [coords[0][0], coords[0][1]];
  const mid = Math.floor(coords.length / 2);
  return [coords[mid][0], coords[mid][1]];
}

export function RoadsFlowLayer({ visible }: { visible: boolean }) {
  const { roads } = useRoadsFlowData();

  const roadsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features: roads
        .filter((road) => road.geometry?.type === "LineString" && Array.isArray(road.geometry.coordinates))
        .map((road) => ({
          type: "Feature",
          properties: {
            id: road.id,
            name: road.name,
            congestion_level: road.congestion_level,
            speed_kmh: road.speed_kmh,
          },
          geometry: road.geometry,
        })),
    }),
    [roads]
  );

  if (!visible) return null;

  return (
    <Source id="roads-flow-source" type="geojson" data={roadsGeoJSON}>
      <Layer
        id="roads-flow-layer"
        type="line"
        paint={{
          "line-color": [
            "match",
            ["get", "congestion_level"],
            "low", CONGESTION_COLORS.low,
            "moderate", CONGESTION_COLORS.moderate,
            "high", CONGESTION_COLORS.high,
            "severe", CONGESTION_COLORS.severe,
            "#64748b",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "speed_kmh"], 10],
            5, 5.5,
            20, 4.5,
            35, 3.5,
            50, 2.5,
          ],
          "line-opacity": 0.85,
        }}
        layout={{ "line-cap": "round", "line-join": "round" }}
      />
    </Source>
  );
}

export function HotspotsLayer({ visible }: { visible: boolean }) {
  const { roads } = useRoadsFlowData();
  const { hotspots } = useHotspotsData();

  const roadsById = useMemo(() => new Map(roads.map((road) => [road.id, road])), [roads]);

  const hotspotsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => {
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

      for (const hotspot of hotspots) {
        const road = roadsById.get(hotspot.road_id);
        if (!road || road.geometry.type !== "LineString") continue;

        const [lng, lat] = lineMidpoint(road.geometry);
        features.push({
          type: "Feature",
          properties: {
            road_name: hotspot.road_name,
            congestion_frequency: hotspot.congestion_frequency,
            total_incidents: hotspot.total_incidents,
          },
          geometry: {
            type: "Point",
            coordinates: [lng, lat] as [number, number],
          },
        });
      }

      return {
        type: "FeatureCollection",
        features,
      };
    },
    [hotspots, roadsById]
  );

  if (!visible) return null;

  return (
    <Source id="hotspots-source" type="geojson" data={hotspotsGeoJSON}>
      <Layer
        id="hotspots-layer"
        type="circle"
        paint={{
          "circle-color": "#b91c1c",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "congestion_frequency"], 0],
            0, 4,
            30, 7,
            60, 11,
            90, 15,
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.85,
        }}
      />
    </Source>
  );
}

export function IncidentLayers({
  showArroyos,
  showEvents,
}: {
  showArroyos: boolean;
  showEvents: boolean;
}) {
  const { arroyos, events } = useMapIncidentsData();

  const arroyosGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>>(
    () => ({
      type: "FeatureCollection",
      features: arroyos.map((arroyo) => ({
        type: "Feature" as const,
        properties: {
          id: arroyo.id,
          name: arroyo.name,
          risk_level: arroyo.risk_level,
        },
        geometry: arroyo.geometry,
      })),
    }),
    [arroyos]
  );

  const eventsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: events.map((event) => ({
        type: "Feature" as const,
        properties: {
          id: event.id,
          title: event.title,
          traffic_impact: event.traffic_impact,
        },
        geometry: event.location,
      })),
    }),
    [events]
  );

  return (
    <>
      {showArroyos && (
        <Source id="arroyos-source" type="geojson" data={arroyosGeoJSON}>
          <Layer
            id="arroyos-fill-layer"
            type="fill"
            paint={{
              "fill-color": [
                "match",
                ["get", "risk_level"],
                "critical", "#7f1d1d",
                "high", "#dc2626",
                "medium", "#f97316",
                "low", "#facc15",
                "#ef4444",
              ],
              "fill-opacity": 0.22,
            }}
          />
          <Layer
            id="arroyos-outline-layer"
            type="line"
            paint={{
              "line-color": "#b91c1c",
              "line-width": 1.5,
              "line-opacity": 0.7,
            }}
          />
        </Source>
      )}

      {showEvents && (
        <Source id="events-source" type="geojson" data={eventsGeoJSON}>
          <Layer
            id="events-impact-layer"
            type="circle"
            paint={{
              "circle-color": [
                "match",
                ["get", "traffic_impact"],
                "severe", "#7c2d12",
                "high", "#ea580c",
                "moderate", "#f59e0b",
                "low", "#22c55e",
                "#ea580c",
              ],
              "circle-radius": [
                "match",
                ["get", "traffic_impact"],
                "severe", 18,
                "high", 14,
                "moderate", 10,
                "low", 7,
                10,
              ],
              "circle-opacity": 0.32,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            }}
          />
        </Source>
      )}
    </>
  );
}
