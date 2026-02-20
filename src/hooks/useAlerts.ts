"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSocketIO } from './useSocketIO';

export interface Alert {
  id: string;
  type: 'arroyo_flood_risk' | 'severe_congestion' | 'weather_traffic_impact' | 'event_traffic_impact';
  severity: 'low' | 'medium' | 'high' | 'critical';
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
      console.log('⚠️ Socket not available for alerts');
      return;
    }

    console.log('🚨 Setting up alerts subscription');

    // Subscribe to alerts channel
    subscribe('alerts');

    // Handle alert notifications
    const handleAlertNotification = (data: AlertNotification) => {
      console.log('🚨 Alert received:', data.alert);
      console.log('🚨 Alert details:', {
        id: data.alert.id,
        title: data.alert.title,
        severity: data.alert.severity,
        timestamp: data.alert.timestamp
      });

      setAlerts((prev) => {
        // Check if alert already exists
        const exists = prev.some(a => a.id === data.alert.id);
        if (exists) {
          console.log('ℹ️ Alert already exists, skipping');
          return prev;
        }

        // Add new alert at the beginning
        console.log('✅ Adding new alert to list. Total alerts:', prev.length + 1);
        return [data.alert, ...prev];
      });
    };

    socket.on('alert:notification', handleAlertNotification);

    // Fetch initial alerts from REST API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    console.log('🚨 Fetching initial alerts from:', `${apiUrl}/alerts/active`);

    fetch(`${apiUrl}/alerts/active`)
      .then(res => res.json())
      .then(data => {
        console.log('🚨 Initial alerts response:', data);
        if (data.status === 'success' && data.data) {
          console.log('✅ Loaded', data.data.length, 'active alerts');
          setAlerts(data.data);
        } else {
          console.log('ℹ️ No active alerts found');
        }
      })
      .catch(error => {
        console.error('❌ Failed to fetch initial alerts:', error);
      });

    return () => {
      socket.off('alert:notification', handleAlertNotification);
    };
  }, [socket, subscribe]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter(a => a.id !== alertId));
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
