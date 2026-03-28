"use client";

import { useState, useCallback, useRef } from 'react';

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
  const activeRequestId = useRef(0);

  const isActiveRequest = useCallback((requestId: number) => activeRequestId.current === requestId, []);

  const readJson = useCallback(async (res: Response) => {
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Respuesta no válida del servicio de predicciones.');
    }
    return res.json();
  }, []);

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

  const fetchTimeline = useCallback(async (roadId: number, requestId?: number) => {
    try {
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/timeline`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson(res);
      if (!requestId || isActiveRequest(requestId)) {
        setTimeline(json.data?.timeline || []);
      }
    } catch (err) {
      if (!requestId || isActiveRequest(requestId)) {
        setTimeline([]);
        setError(err instanceof Error ? err.message : 'Error fetching timeline');
      }
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchExplanation = useCallback(async (roadId: number, requestId?: number) => {
    try {
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/explanation`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson(res);
      if (!requestId || isActiveRequest(requestId)) {
        setExplanation(json.data || null);
      }
    } catch (err) {
      if (!requestId || isActiveRequest(requestId)) {
        setExplanation(null);
        setError(err instanceof Error ? err.message : 'Error fetching explanation');
      }
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchArroyoRisk = useCallback(async (requestId?: number) => {
    try {
      const res = await fetch(`${API_BASE}/predictions/arroyo-risk`);
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson(res);
      if (!requestId || isActiveRequest(requestId)) {
        setArroyoRisk(json.data || null);
      }
    } catch (err) {
      if (!requestId || isActiveRequest(requestId)) {
        setArroyoRisk(null);
        setError(err instanceof Error ? err.message : 'Error fetching arroyo risk');
      }
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchAll = useCallback(async (roadId: number) => {
    const requestId = Date.now();
    activeRequestId.current = requestId;
    setIsLoading(true);
    setError(null);
    const mlReady = await isMLAvailable();
    if (!isActiveRequest(requestId)) {
      return;
    }
    if (!mlReady) {
      setTimeline([]);
      setExplanation(null);
      setArroyoRisk(null);
      setError('Servicio ML no disponible o modelo no entrenado.');
      setIsLoading(false);
      return;
    }
    await Promise.all([
      fetchTimeline(roadId, requestId),
      fetchExplanation(roadId, requestId),
      fetchArroyoRisk(requestId),
    ]);
    if (isActiveRequest(requestId)) {
      setIsLoading(false);
    }
  }, [fetchTimeline, fetchExplanation, fetchArroyoRisk, isMLAvailable, isActiveRequest]);

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
