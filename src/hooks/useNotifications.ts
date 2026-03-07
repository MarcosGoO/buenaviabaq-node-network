"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { type Alert } from './useAlerts';
import { type AppSettings } from './useSettings';

export interface Toast {
  id: string;
  alert: Alert;
  dismissAt: number;
}

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 } as const;

function meetsMinSeverity(
  alertSeverity: Alert['severity'],
  minSeverity: AppSettings['minAlertSeverity']
): boolean {
  return SEVERITY_ORDER[alertSeverity] >= SEVERITY_ORDER[minSeverity];
}

// Duration (ms) for auto-dismiss by severity
const TOAST_DURATION: Record<Alert['severity'], number> = {
  low: 4000,
  medium: 6000,
  high: 8000,
  critical: 0, // critical → Web Notification only, no auto-dismiss toast
};

interface UseNotificationsReturn {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  permissionState: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<void>;
}

export function useNotifications(
  alerts: Alert[],
  minAlertSeverity: AppSettings['minAlertSeverity'],
  showAlerts: boolean
): UseNotificationsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const seenIds = useRef<Set<string>>(new Set());

  // Init permission state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermissionState('unsupported');
    } else {
      setPermissionState(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
  }, []);

  // React to new alerts
  useEffect(() => {
    if (!showAlerts) return;

    alerts.forEach((alert) => {
      // Skip already-processed alerts
      if (seenIds.current.has(alert.id)) return;

      // Skip if below minAlertSeverity
      if (!meetsMinSeverity(alert.severity, minAlertSeverity)) return;

      seenIds.current.add(alert.id);

      if (alert.severity === 'critical') {
        // Web Notification for critical alerts
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(`VíaBaq — ${alert.title}`, {
              body: alert.description,
              icon: '/favicon.ico',
              tag: alert.id,
              requireInteraction: true,
            });
          } catch {
            // Silently ignore (e.g. service worker not registered in dev)
          }
        }
      } else {
        // Toast notification for low/medium/high
        const duration = TOAST_DURATION[alert.severity];
        const toast: Toast = {
          id: alert.id,
          alert,
          dismissAt: Date.now() + duration,
        };

        setToasts((prev) => {
          if (prev.some((t) => t.id === alert.id)) return prev;
          return [toast, ...prev];
        });

        // Auto-dismiss after duration
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== alert.id));
        }, duration);
      }
    });
  }, [alerts, minAlertSeverity, showAlerts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, dismissToast, permissionState, requestPermission };
}
