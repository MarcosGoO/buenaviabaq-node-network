"use client";

import React, { useEffect, useState } from 'react';
import { useSocketIO } from '@/hooks/useSocketIO';
import { Bell, CheckCircle2, WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Update {
  id: string;
  type: 'traffic' | 'weather' | 'event';
  message: string;
  timestamp: string;
}

export default function RealTimeUpdates() {
  const { socket, isConnected, subscribe, unsubscribe } = useSocketIO();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to all channels
    subscribe('traffic');
    subscribe('weather');
    subscribe('events');

    // Listen for traffic updates
    socket.on('traffic:update', (data) => {
      const update: Update = {
        id: `traffic-${Date.now()}`,
        type: 'traffic',
        message: `Actualización de tráfico: ${data.data.summary.status}`,
        timestamp: data.timestamp,
      };
      addUpdate(update);
    });

    // Listen for weather updates
    socket.on('weather:update', (data) => {
      const update: Update = {
        id: `weather-${Date.now()}`,
        type: 'weather',
        message: `Clima actualizado: ${data.data.temperature}°C, ${data.data.condition}`,
        timestamp: data.timestamp,
      };
      addUpdate(update);
    });

    // Listen for event notifications
    socket.on('event:notification', (data) => {
      const update: Update = {
        id: `event-${Date.now()}`,
        type: 'event',
        message: `Evento: ${data.event.title}`,
        timestamp: data.timestamp,
      };
      addUpdate(update);
    });

    return () => {
      unsubscribe('traffic');
      unsubscribe('weather');
      unsubscribe('events');
      socket.off('traffic:update');
      socket.off('weather:update');
      socket.off('event:notification');
    };
  }, [socket, subscribe, unsubscribe]);

  const addUpdate = (update: Update) => {
    setUpdates((prev) => [update, ...prev].slice(0, 10)); // Keep only last 10
    setShowNotifications(true);

    // Show toast notification
    showToast(update);

    // Auto-hide notification indicator after 3 seconds
    setTimeout(() => {
      setShowNotifications(false);
    }, 3000);
  };

  const showToast = (update: Update) => {
    // Create a temporary toast element
    const toast = document.createElement('div');
    toast.className = cn(
      'fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg',
      'bg-background border-2 border-primary',
      'transform transition-all duration-300',
      'animate-in slide-in-from-bottom-5'
    );
    toast.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
        <div>
          <p class="font-semibold text-sm">${getUpdateTypeLabel(update.type)}</p>
          <p class="text-xs text-muted-foreground">${update.message}</p>
        </div>
      </div>
    `;

    document.body.appendChild(toast);

    // Remove after 4 seconds
    setTimeout(() => {
      toast.classList.add('animate-out', 'slide-out-to-bottom-5');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  const getUpdateTypeLabel = (type: string) => {
    switch (type) {
      case 'traffic':
        return 'Actualización de Tráfico';
      case 'weather':
        return 'Actualización de Clima';
      case 'event':
        return 'Nuevo Evento';
      default:
        return 'Actualización';
    }
  };

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case 'traffic':
        return 'bg-blue-500/10 text-blue-500';
      case 'weather':
        return 'bg-green-500/10 text-green-500';
      case 'event':
        return 'bg-orange-500/10 text-orange-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const deleteUpdate = (id: string) => {
    setUpdates((prev) => prev.filter((update) => update.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-40" suppressHydrationWarning>
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-background/95 backdrop-blur shadow-lg border" suppressHydrationWarning>
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium">En vivo</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium">Desconectado</span>
          </>
        )}

        {showNotifications && (
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse ml-2"></div>
        )}
      </div>

      {/* Updates List */}
      {updates.length > 0 && (
        <div className="w-80 max-h-96 overflow-y-auto rounded-lg bg-background/95 backdrop-blur shadow-lg border p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Actualizaciones Recientes
            </h3>
            <button
              onClick={() => setUpdates([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          </div>

          {updates.map((update) => (
            <div
              key={update.id}
              className="group p-3 rounded-md bg-muted/50 border border-border/50 space-y-1 hover:bg-muted/70 transition-colors relative"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getUpdateTypeColor(update.type)
                  )}
                >
                  {getUpdateTypeLabel(update.type)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(update.timestamp).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  onClick={() => deleteUpdate(update.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  title="Eliminar notificación"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <p className="text-sm pr-6">{update.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}