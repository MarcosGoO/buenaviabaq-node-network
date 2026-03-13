"use client";

import { useCallback, useState } from "react";
import type { RouteCoord } from "@/hooks/useRouting";

const STORAGE_KEY = "viabaq:favorite-route-plan";

export interface FavoriteRoutePlan {
  origin: RouteCoord;
  destination: RouteCoord;
  originLabel: string;
  destinationLabel: string;
  avoidArroyos: boolean;
  avoidCongestion: boolean;
  savedAt: string;
}

export function useFavoriteRoutePlan() {
  const [plan, setPlan] = useState<FavoriteRoutePlan | null>(() => {
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

  const savePlan = useCallback((nextPlan: FavoriteRoutePlan) => {
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

