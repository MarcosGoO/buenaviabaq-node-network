"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocketIO } from "./useSocketIO";

export interface Alert {
  id: string;
  type: "arroyo_flood_risk" | "severe_congestion" | "weather_traffic_impact" | "event_traffic_impact";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  affectedZones: number[];
  affectedRoads?: number[];
  timestamp: string;
  expiresAt: string;
  metadata: {
    weatherCondition?: string;
    rainfall?: number;
    congestionLevel?: string;
    eventId?: number;
    [key: string]: unknown;
  };
}

interface AlertNotification {
  timestamp: string;
  alert: Alert;
}

interface AlertsApiResponse {
  success: boolean;
  alerts?: Alert[];
}

interface UseAlertsReturn {
  alerts: Alert[];
  isConnected: boolean;
  dismissAlert: (alertId: string) => void;
  clearAll: () => void;
}

export function useAlerts(): UseAlertsReturn {
  const { socket, isConnected, subscribe } = useSocketIO();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    subscribe("alerts");

    const handleAlertNotification = (data: AlertNotification) => {
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === data.alert.id);
        return exists ? prev : [data.alert, ...prev];
      });
    };

    socket.on("alert:notification", handleAlertNotification);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

    fetch(`${apiUrl}/alerts/active`)
      .then(async (res): Promise<AlertsApiResponse | null> => {
        if (!res.ok) {
          const rawError = await res.text();
          console.warn("Alerts endpoint returned non-OK status", {
            status: res.status,
            body: rawError.slice(0, 120),
          });
          return null;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const rawBody = await res.text();
          console.warn("Alerts endpoint returned non-JSON payload", {
            contentType,
            body: rawBody.slice(0, 120),
          });
          return null;
        }

        return (await res.json()) as AlertsApiResponse;
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch initial alerts:", error);
      });

    return () => {
      socket.off("alert:notification", handleAlertNotification);
    };
  }, [socket, subscribe]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    isConnected,
    dismissAlert,
    clearAll,
  };
}
