"use client";

import { useCallback, useEffect, useState } from "react";

interface ArroyoZone {
  id: number;
  name: string;
  risk_level: "low" | "medium" | "high" | "critical";
  geometry: GeoJSON.MultiPolygon;
}

interface EventItem {
  id: number;
  title: string;
  traffic_impact: "low" | "moderate" | "high" | "severe";
  location: GeoJSON.Point;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  start_time: string;
  end_time: string;
}

interface UseMapIncidentsDataReturn {
  arroyos: ArroyoZone[];
  events: EventItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function useMapIncidentsData(): UseMapIncidentsDataReturn {
  const [arroyos, setArroyos] = useState<ArroyoZone[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [arroyosRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/geo/arroyos?verified=true`),
        fetch(`${API_URL}/events/upcoming`),
      ]);

      if (arroyosRes.ok) {
        const arroyosData = (await arroyosRes.json()) as {
          status?: string;
          data?: ArroyoZone[];
        };
        if (arroyosData.status === "success" && Array.isArray(arroyosData.data)) {
          setArroyos(arroyosData.data);
        }
      }

      if (eventsRes.ok) {
        const eventsData = (await eventsRes.json()) as {
          status?: string;
          data?: EventItem[];
        };
        if (eventsData.status === "success" && Array.isArray(eventsData.data)) {
          setEvents(eventsData.data.filter((event) => event.status === "scheduled" || event.status === "ongoing"));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  return {
    arroyos,
    events,
    isLoading,
    error,
    refresh: fetchIncidents,
  };
}
