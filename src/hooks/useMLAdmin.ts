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

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/session`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setIsAuthenticated(false);
        return false;
      }
      const json = (await res.json()) as { data?: { authenticated?: boolean } };
      const authenticated = Boolean(json.data?.authenticated);
      setIsAuthenticated(authenticated);
      return authenticated;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const loginWithAdminKey = useCallback(async (adminKey: string) => {
    const key = adminKey.trim();
    if (!key) return false;
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'x-admin-key': key },
      credentials: 'include',
    });
    const ok = res.ok;
    if (ok) setIsAuthenticated(true);
    return ok;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null);
    setIsAuthenticated(false);
  }, []);

  const fetchModelHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/ml/model-history`, {
        credentials: 'include',
      });
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
      const res = await fetch(`${API_BASE}/ml/retrain`, {
        method: 'POST',
        credentials: 'include',
      });
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
      const res = await fetch(`${API_BASE}/ml/rollback/${version}`, {
        method: 'POST',
        credentials: 'include',
      });
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
    isAuthenticated,
    retrainStatus,
    isLoading,
    error,
    checkSession,
    loginWithAdminKey,
    logout,
    fetchModelHistory,
    fetchHealth,
    triggerRetrain,
    rollbackModel,
    fetchAll,
  };
}
