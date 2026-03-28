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

type ResourceState = {
  loading: boolean;
  error: string | null;
};

type ReadJsonResponse<T> = {
  data?: T;
};

function defaultResourceState(): ResourceState {
  return { loading: false, error: null };
}

export function usePredictions() {
  const [timeline, setTimeline] = useState<TimelinePrediction[]>([]);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [arroyoRisk, setArroyoRisk] = useState<ArroyoRiskData | null>(null);

  const [timelineState, setTimelineState] = useState<ResourceState>(defaultResourceState);
  const [explanationState, setExplanationState] = useState<ResourceState>(defaultResourceState);
  const [arroyoRiskState, setArroyoRiskState] = useState<ResourceState>(defaultResourceState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlAvailable, setMlAvailable] = useState<boolean | null>(null);

  const activeRequestId = useRef(0);

  const isActiveRequest = useCallback((requestId: number) => activeRequestId.current === requestId, []);

  const readJson = useCallback(async <T,>(res: Response): Promise<ReadJsonResponse<T>> => {
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Respuesta no valida del servicio de predicciones.');
    }
    return (await res.json()) as ReadJsonResponse<T>;
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

  const isMLReady = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE}/predictions/health`, { signal });
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return false;
      const json = (await res.json()) as { data?: { ml_service_available?: boolean } };
      return Boolean(json.data?.ml_service_available);
    } catch {
      return false;
    }
  }, []);

  const fetchTimeline = useCallback(async (roadId: number, requestId: number, signal?: AbortSignal) => {
    setTimelineState({ loading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/timeline`, { signal });
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson<{ timeline?: TimelinePrediction[] }>(res);

      if (!isActiveRequest(requestId)) return;

      setTimeline(Array.isArray(json.data?.timeline) ? json.data.timeline : []);
      setTimelineState({ loading: false, error: null });
      return null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      if (!isActiveRequest(requestId)) return;

      const message = err instanceof Error ? err.message : 'Error fetching timeline';
      setTimeline([]);
      setTimelineState({ loading: false, error: message });
      return message;
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchExplanation = useCallback(async (roadId: number, requestId: number, signal?: AbortSignal) => {
    setExplanationState({ loading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/predictions/road/${roadId}/explanation`, { signal });
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson<ExplanationData>(res);

      if (!isActiveRequest(requestId)) return;

      setExplanation(json.data ?? null);
      setExplanationState({ loading: false, error: null });
      return null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      if (!isActiveRequest(requestId)) return;

      const message = err instanceof Error ? err.message : 'Error fetching explanation';
      setExplanation(null);
      setExplanationState({ loading: false, error: message });
      return message;
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchArroyoRisk = useCallback(async (requestId?: number, signal?: AbortSignal) => {
    const effectiveRequestId = requestId ?? Date.now();
    if (!requestId) {
      activeRequestId.current = effectiveRequestId;
    }

    setArroyoRiskState({ loading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/predictions/arroyo-risk`, { signal });
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const json = await readJson<ArroyoRiskData>(res);

      if (!isActiveRequest(effectiveRequestId)) return;

      setArroyoRisk(json.data ?? null);
      setArroyoRiskState({ loading: false, error: null });
      return null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      if (!isActiveRequest(effectiveRequestId)) return;

      const message = err instanceof Error ? err.message : 'Error fetching arroyo risk';
      setArroyoRisk(null);
      setArroyoRiskState({ loading: false, error: message });
      return message;
    }
  }, [getErrorMessage, isActiveRequest, readJson]);

  const fetchAll = useCallback(async (roadId: number) => {
    const requestId = Date.now();
    activeRequestId.current = requestId;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const mlReady = await isMLReady(controller.signal);

    if (!isActiveRequest(requestId)) {
      controller.abort();
      return;
    }

    setMlAvailable(mlReady);

    if (!mlReady) {
      setTimeline([]);
      setExplanation(null);
      setTimelineState({ loading: false, error: 'Servicio ML no disponible o modelo no entrenado.' });
      setExplanationState({ loading: false, error: 'Servicio ML no disponible o modelo no entrenado.' });
      setError('Servicio ML no disponible o modelo no entrenado.');
      setIsLoading(false);
      return;
    }

    const [timelineResult, explanationResult, arroyoResult] = await Promise.all([
      fetchTimeline(roadId, requestId, controller.signal),
      fetchExplanation(roadId, requestId, controller.signal),
      fetchArroyoRisk(requestId, controller.signal),
    ]);

    if (!isActiveRequest(requestId)) {
      controller.abort();
      return;
    }

    const sectionErrors = [timelineResult, explanationResult, arroyoResult].filter(Boolean);

    setError(sectionErrors.length > 0 ? 'Algunas secciones no pudieron cargarse por completo.' : null);
    setIsLoading(false);
  }, [fetchArroyoRisk, fetchExplanation, fetchTimeline, isActiveRequest, isMLReady]);

  return {
    timeline,
    explanation,
    arroyoRisk,
    isLoading,
    error,
    mlAvailable,
    timelineLoading: timelineState.loading,
    timelineError: timelineState.error,
    explanationLoading: explanationState.loading,
    explanationError: explanationState.error,
    arroyoRiskLoading: arroyoRiskState.loading,
    arroyoRiskError: arroyoRiskState.error,
    fetchTimeline,
    fetchExplanation,
    fetchArroyoRisk,
    fetchAll,
  };
}
