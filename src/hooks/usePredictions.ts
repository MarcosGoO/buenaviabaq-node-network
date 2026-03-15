"use client";

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface TimelinePrediction {
  horizon_minutes: number;
  prediction: {
    road_id: number;
    timestamp: string;
    predicted_speed_kmh: number;
    predicted_speed_lower: number | null;
    predicted_speed_upper: number | null;
    predicted_congestion_level: string;
    confidence_score: number | null;
    model_version: string;
  };
}

export interface ExplanationFeature {
  feature_name: string;
  shap_value: number;
  contribution: 'positive' | 'negative' | 'neutral';
}

export interface ExplanationData {
  road_id: number;
  timestamp: string;
  top_features: ExplanationFeature[];
  model_version: string;
}

export interface ArroyoRiskEntry {
  arroyo_id: number;
  zone_name: string;
  activation_probability: number;
  risk_level: string;
}

export interface ArroyoRiskData {
  timestamp: string;
  weather_summary: Record<string, unknown>;
  arroyos: ArroyoRiskEntry[];
}

export function usePredictions() {
  const [timeline, setTimeline] = useState<TimelinePrediction[]>([]);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [arroyoRisk, setArroyoRisk] = useState<ArroyoRiskData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = useCallback((status: number) => {
    if (status === 503) {
      return 'Servicio ML no disponible o modelo no entrenado.';
    }
    if (status === 429) {
      return 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.';
    }
    if (status === 401) {
      return 'No autorizado para consultar predicciones.';
    }
    return `HTTP ${status}`;
  }, []);

  const isMLAvailable = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/predictions/health`);
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return false;
      const json = (await res.json()) as { data?: { ml_service_available?: boolean } };
      return Boolean(json.data?.ml_service_available);
    } catch {
      return false;
    }
  }, []);

  const fetchTimeline = useCallback(async (roadId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/timeline`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await res.json();
      setTimeline(json.data?.timeline || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching timeline');
    } finally {
      setIsLoading(false);
    }
  }, [getErrorMessage]);

  const fetchExplanation = useCallback(async (roadId: number) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/explanation`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await res.json();
      setExplanation(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching explanation');
    }
  }, [getErrorMessage]);

  const fetchArroyoRisk = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/predictions/arroyo-risk`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await res.json();
      setArroyoRisk(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching arroyo risk');
    }
  }, [getErrorMessage]);

  const fetchAll = useCallback(async (roadId: number) => {
    setIsLoading(true);
    const mlReady = await isMLAvailable();
    if (!mlReady) {
      setTimeline([]);
      setExplanation(null);
      setArroyoRisk(null);
      setError('Servicio ML no disponible o modelo no entrenado.');
      setIsLoading(false);
      return;
    }
    await Promise.all([
      fetchTimeline(roadId),
      fetchExplanation(roadId),
      fetchArroyoRisk(),
    ]);
    setIsLoading(false);
  }, [fetchTimeline, fetchExplanation, fetchArroyoRisk, isMLAvailable]);

  return {
    timeline,
    explanation,
    arroyoRisk,
    isLoading,
    error,
    fetchTimeline,
    fetchExplanation,
    fetchArroyoRisk,
    fetchAll,
  };
}
