"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "viabaq:departure-plan";

export interface SavedDeparturePlan {
  departureTime: string;
  riskScore: number;
  rainProbability: number;
  recommendation: string;
  savedAt: string;
}

export function useDeparturePlan() {
  const [plan, setPlan] = useState<SavedDeparturePlan | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const savePlan = useCallback((nextPlan: SavedDeparturePlan) => {
    setPlan(nextPlan);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlan));
  }, []);

  const clearPlan = useCallback(() => {
    setPlan(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    plan,
    savePlan,
    clearPlan,
  };
}
