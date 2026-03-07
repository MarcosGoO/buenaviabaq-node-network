"use client";

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ModelVersion {
  version: string;
  model_type: string;
  metrics: Record<string, number> | null;
  trained_at: string | null;
  training_samples: number;
  file: string;
}

export interface ModelHistory {
  versions: ModelVersion[];
  count: number;
  active_model_version: string | null;
}

export interface SystemHealth {
  ml_service_available: boolean;
  checked_at: string;
}

export function useMLAdmin() {
  const [modelHistory, setModelHistory] = useState<ModelHistory | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [retrainStatus, setRetrainStatus] = useState<'idle' | 'queued' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModelHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/ml/model-history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setModelHistory(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching model history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/predictions/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setHealth(json.data || null);
    } catch {
      setHealth({ ml_service_available: false, checked_at: new Date().toISOString() });
    }
  }, []);

  const triggerRetrain = useCallback(async () => {
    try {
      setRetrainStatus('queued');
      setError(null);
      const res = await fetch(`${API_BASE}/ml/retrain`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // After triggering, refresh history after a delay
      setTimeout(() => fetchModelHistory(), 5000);
    } catch (err) {
      setRetrainStatus('error');
      setError(err instanceof Error ? err.message : 'Error triggering retrain');
    }
  }, [fetchModelHistory]);

  const rollbackModel = useCallback(async (version: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/ml/rollback/${version}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchModelHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error rolling back model');
    }
  }, [fetchModelHistory]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchModelHistory(), fetchHealth()]);
    setIsLoading(false);
  }, [fetchModelHistory, fetchHealth]);

  return {
    modelHistory,
    health,
    retrainStatus,
    isLoading,
    error,
    fetchModelHistory,
    fetchHealth,
    triggerRetrain,
    rollbackModel,
    fetchAll,
  };
}
