"use client";

import { useEffect, useState } from "react";

interface FeatureCollection<TGeometry extends GeoJSON.Geometry> {
  type: "FeatureCollection";
  features: Array<GeoJSON.Feature<TGeometry>>;
}

interface UseSodaMapLayersReturn {
  photodetection: FeatureCollection<GeoJSON.Point> | null;
  semaforos: FeatureCollection<GeoJSON.Point> | null;
}

async function fetchGeoJSON<TGeometry extends GeoJSON.Geometry>(
  url: string
): Promise<FeatureCollection<TGeometry> | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as FeatureCollection<TGeometry>;
    if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function useSodaMapLayers(): UseSodaMapLayersReturn {
  const [photodetection, setPhotodetection] = useState<FeatureCollection<GeoJSON.Point> | null>(null);
  const [semaforos, setSemaforos] = useState<FeatureCollection<GeoJSON.Point> | null>(null);

  useEffect(() => {
    fetchGeoJSON<GeoJSON.Point>("/geo/hotspots.fotodeteccion.geojson").then(setPhotodetection);
    fetchGeoJSON<GeoJSON.Point>("/geo/semaforizacion.geojson").then(setSemaforos);
  }, []);

  return { photodetection, semaforos };
}

