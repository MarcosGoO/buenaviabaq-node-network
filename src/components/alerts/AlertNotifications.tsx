"use client";

import { useEffect, useState } from 'react';
import { useAlerts, type Alert } from '@/hooks/useAlerts';
import { X, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface AlertNotificationProps {
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function AlertNotifications({
  maxVisible = 3,
  position = 'top-right'
}: AlertNotificationProps) {
  const { alerts, dismissAlert, clearAll } = useAlerts();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Derive visibleAlerts directly from alerts instead of using state
  const visibleAlerts = isExpanded ? alerts : alerts.slice(0, maxVisible);

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

  // Only hide if there are no alerts - don't wait for connection
  if (alerts.length === 0) {
    return null;
  }

  if (isMinimized) {
    return (
      <div
        className={`fixed ${getPositionStyles()} z-[9999] flex items-center gap-2`}
        role="alert"
        aria-live="polite"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors"
        >
          <AlertCircle className="w-4 h-4" />
          {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed ${getPositionStyles()} z-[9999] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]`}
      role="alert"
      aria-live="polite"
      suppressHydrationWarning
    >
      {/* Header */}
      {alerts.length > 0 && (
        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">
              {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > maxVisible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hover:opacity-70 transition-opacity"
                aria-label={isExpanded ? "Mostrar menos" : "Mostrar todas"}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setIsMinimized(true)}
              className="hover:opacity-70 transition-opacity"
              aria-label="Minimizar alertas"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={clearAll}
              className="hover:opacity-70 transition-opacity"
              aria-label="Cerrar todas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alert list with scroll */}
      <div className={`flex flex-col gap-2 ${isExpanded ? 'max-h-[70vh] overflow-y-auto' : ''}`} suppressHydrationWarning>
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
                      {alert.affectedZones.length} zona{alert.affectedZones.length !== 1 ? 's' : ''}
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

      {/* Show more indicator */}
      {!isExpanded && alerts.length > maxVisible && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg text-xs hover:bg-gray-600 transition-colors text-center"
        >
          Ver {alerts.length - maxVisible} más
        </button>
      )}
    </div>
  );
}
