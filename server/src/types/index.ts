// Common types for the API

// PostGIS geometry type (GeoJSON-like structure)
export interface PostGISGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][];
  crs?: {
    type: string;
    properties: Record<string, unknown>;
  };
}

export interface GeoZone {
  id: number;
  name: string;
  zone_type: string;
  parent_id: number | null;
  geometry: PostGISGeometry;
  population: number | null;
  area_km2: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ArroyoZone {
  id: number;
  name: string;
  zone_id: number | null;
  geometry: PostGISGeometry;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  drainage_capacity_m3: number | null;
  last_incident_date: Date | null;
  avg_flood_depth_cm: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Road {
  id: number;
  name: string;
  road_type: string;
  geometry: PostGISGeometry;
  lanes: number | null;
  max_speed_kmh: number | null;
  length_km: number | null;
  one_way: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface POI {
  id: number;
  name: string;
  category: string;
  geometry: PostGISGeometry;
  zone_id: number | null;
  address: string | null;
  capacity: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  timestamp: string;
}
