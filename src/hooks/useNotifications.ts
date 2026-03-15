"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Alert } from "./useAlerts";
import { type AppSettings } from "./useSettings";

export interface Toast {
  id: string;
  alert: Alert;
  dismissAt: number;
}

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 } as const;

function meetsMinSeverity(alertSeverity: Alert["severity"], minSeverity: AppSettings["minAlertSeverity"]): boolean {
  return SEVERITY_ORDER[alertSeverity] >= SEVERITY_ORDER[minSeverity];
}

const TOAST_DURATION: Record<Alert["severity"], number> = {
  low: 4000,
  medium: 6000,
  high: 8000,
  critical: 0,
};

interface UseNotificationsReturn {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  permissionState: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
}

export function useNotifications(
  alerts: Alert[],
  minAlertSeverity: AppSettings["minAlertSeverity"],
  showAlerts: boolean
): UseNotificationsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  const seenIds = useRef<Set<string>>(new Set());
  const timeoutMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
  }, []);

  useEffect(() => {
    if (!showAlerts) return;

    alerts.forEach((alert) => {
      if (seenIds.current.has(alert.id)) return;
      if (!meetsMinSeverity(alert.severity, minAlertSeverity)) return;

      seenIds.current.add(alert.id);

      if (alert.severity === "critical") {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`ViaBaq - ${alert.title}`, {
              body: alert.description,
              icon: "/favicon.ico",
              tag: alert.id,
              requireInteraction: true,
            });
          } catch {
            // Ignore notification API errors in unsupported environments.
          }
        }
        return;
      }

      const duration = TOAST_DURATION[alert.severity];
      const toast: Toast = {
        id: alert.id,
        alert,
        dismissAt: Date.now() + duration,
      };

      setToasts((prev) => (prev.some((item) => item.id === alert.id) ? prev : [toast, ...prev]));

      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== alert.id));
        timeoutMap.current.delete(alert.id);
      }, duration);

      timeoutMap.current.set(alert.id, timeout);
    });
  }, [alerts, minAlertSeverity, showAlerts]);

  useEffect(() => {
    const timeouts = timeoutMap.current;
    return () => {
      timeouts.forEach((timer) => clearTimeout(timer));
      timeouts.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = timeoutMap.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutMap.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { toasts, dismissToast, permissionState, requestPermission };
}

