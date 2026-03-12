"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export interface DepartureWindowAdvice {
  departure_time: string;
  expected_avg_speed_kmh: number;
  expected_travel_time_minutes: number;
  congestion_risk: "low" | "moderate" | "high";
  rain_probability: number;
  risk_score: number;
  recommendation: string;
}

export interface DepartureAdvice {
  generated_at: string;
  parameters: {
    hours_ahead: number;
    interval_minutes: number;
  };
  best_departure: DepartureWindowAdvice;
  windows: DepartureWindowAdvice[];
  context: {
    active_alerts: number;
    critical_alerts: number;
    rain_now_probability: number;
  };
}

export function useDepartureAdvice(hours = 4, interval = 30) {
  const [advice, setAdvice] = useState<DepartureAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE}/insights/departure-advice?hours=${hours}&interval=${interval}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch departure advice");
      }

      const payload = await response.json();
      setAdvice(payload.data ?? null);
    } catch {
      setError("No fue posible cargar la recomendacion de salida.");
    } finally {
      setLoading(false);
    }
  }, [hours, interval]);

  useEffect(() => {
    fetchAdvice();

    const timer = setInterval(fetchAdvice, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchAdvice]);

  return {
    advice,
    loading,
    error,
    refetch: fetchAdvice,
  };
}

