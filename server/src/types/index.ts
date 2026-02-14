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

// ML Feature Store Types
export interface MLFeature {
  id: number;
  road_id: number;
  timestamp: Date;

  // Temporal features
  hour_of_day: number;
  day_of_week: number;
  day_of_month: number;
  month: number;
  is_rush_hour: boolean;
  is_weekend: boolean;

  // Traffic historical features
  avg_speed_historical: number | null;
  avg_congestion_level_encoded: number | null;
  traffic_std_deviation: number | null;

  // Weather features
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  rain_probability: number | null;
  weather_condition_encoded: number | null;
  is_raining: boolean | null;

  // Event features
  event_nearby: boolean;
  event_type_encoded: number | null;
  event_distance_km: number | null;

  // Geographic features
  zone_id: number | null;
  road_type_encoded: number | null;
  lanes: number | null;
  max_speed_kmh: number | null;

  // Arroyo risk features
  arroyo_nearby: boolean;
  arroyo_risk_level_encoded: number | null;
  arroyo_distance_km: number | null;

  // Target variable
  target_speed_kmh: number | null;
  target_congestion_level: string | null;

  created_at: Date;
}

export interface FeatureVector {
  road_id: number;
  timestamp: Date;
  features: {
    temporal: {
      hour_of_day: number;
      day_of_week: number;
      day_of_month: number;
      month: number;
      is_rush_hour: boolean;
      is_weekend: boolean;
    };
    traffic: {
      avg_speed_historical: number | null;
      avg_congestion_encoded: number | null;
      std_deviation: number | null;
    };
    weather: {
      temperature: number | null;
      humidity: number | null;
      wind_speed: number | null;
      rain_probability: number | null;
      condition_encoded: number | null;
      is_raining: boolean;
    };
    events: {
      nearby: boolean;
      type_encoded: number | null;
      distance_km: number | null;
    };
    geography: {
      zone_id: number | null;
      road_type_encoded: number | null;
      lanes: number | null;
      max_speed: number | null;
    };
    arroyo: {
      nearby: boolean;
      risk_encoded: number | null;
      distance_km: number | null;
    };
  };
}

export interface FeatureExtractionOptions {
  roadId: number;
  timestamp?: Date;
  includeTarget?: boolean;
}
