"use client";

import { useEffect, useState } from 'react';
import { useAlerts, type Alert } from '@/hooks/useAlerts';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface AlertNotificationProps {
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function AlertNotifications({
  maxVisible = 5,
  position = 'top-right'
}: AlertNotificationProps) {
  const { alerts, isConnected, dismissAlert } = useAlerts();
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Show only the most recent alerts up to maxVisible
    setVisibleAlerts(alerts.slice(0, maxVisible));
  }, [alerts, maxVisible]);

  // Auto-dismiss non-critical alerts after 10 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    visibleAlerts.forEach(alert => {
      if (alert.severity !== 'critical' && alert.severity !== 'high') {
        const timer = setTimeout(() => {
          dismissAlert(alert.id);
        }, 10000);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleAlerts, dismissAlert]);

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-500 text-red-900';
      case 'high':
        return 'bg-orange-50 border-orange-500 text-orange-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'low':
        return 'bg-green-50 border-green-500 text-green-900';
      default:
        return 'bg-gray-50 border-gray-500 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-5 h-5" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5" />;
      case 'low':
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed ${getPositionStyles()} z-50 flex flex-col gap-3 w-96 max-w-[calc(100vw-2rem)]`}
      role="alert"
      aria-live="polite"
    >
      {/* Connection status indicator */}
      {!isConnected && (
        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          Reconectando...
        </div>
      )}

      {/* Alert notifications */}
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`
            ${getSeverityStyles(alert.severity)}
            border-l-4 rounded-lg shadow-lg p-4
            transform transition-all duration-300 ease-in-out
            hover:scale-[1.02] hover:shadow-xl
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm">
                  {alert.title}
                </h4>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity"
                  aria-label="Descartar alerta"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm mt-1 opacity-90">
                {alert.description}
              </p>

              {/* Metadata */}
              <div className="flex items-center gap-4 mt-2 text-xs opacity-75">
                <span className="capitalize">
                  {alert.severity}
                </span>
                {alert.affectedZones.length > 0 && (
                  <span>
                    {alert.affectedZones.length} zona{alert.affectedZones.length !== 1 ? 's' : ''} afectada{alert.affectedZones.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span>
                  {new Date(alert.timestamp).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
