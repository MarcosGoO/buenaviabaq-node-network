"use client";

import React, { useEffect, useState } from "react";
import { useSocketIO } from "@/hooks/useSocketIO";
import { BellRing, Wifi, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Update {
  id: string;
  level: "info" | "success" | "warning";
  source: "traffic" | "weather" | "event";
  message: string;
  timestamp: string;
}

const SOURCE_LABEL: Record<Update["source"], string> = {
  traffic: "Tráfico",
  weather: "Clima",
  event: "Eventos",
};

const LEVEL_CLASS: Record<Update["level"], string> = {
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export default function RealTimeUpdates() {
  const { socket, isConnected, subscribe, unsubscribe } = useSocketIO();
  const [updates, setUpdates] = useState<Update[]>([]);

  const addUpdate = React.useCallback((update: Update) => {
    setUpdates((prev) => [update, ...prev].slice(0, 8));
  }, []);

  useEffect(() => {
    if (!socket) return;

    subscribe("traffic");
    subscribe("weather");
    subscribe("events");

    const onTraffic = (data: { data?: { summary?: { status?: string } }; timestamp: string }) => {
      addUpdate({
        id: `traffic-${Date.now()}`,
        source: "traffic",
        level: "info",
        message: data.data?.summary?.status ? `Estado vial: ${data.data.summary.status}` : "Actualización vial recibida",
        timestamp: data.timestamp,
      });
    };

    const onWeather = (data: { data?: { temperature?: number; condition?: string }; timestamp: string }) => {
      const condition = data.data?.condition ?? "sin detalle";
      const temperature = data.data?.temperature;
      addUpdate({
        id: `weather-${Date.now()}`,
        source: "weather",
        level: "success",
        message: temperature != null ? `Clima: ${temperature}°C, ${condition}` : `Clima actualizado: ${condition}`,
        timestamp: data.timestamp,
      });
    };

    const onEvent = (data: { event?: { title?: string }; timestamp: string }) => {
      addUpdate({
        id: `event-${Date.now()}`,
        source: "event",
        level: "warning",
        message: data.event?.title ? `Evento: ${data.event.title}` : "Nuevo evento detectado",
        timestamp: data.timestamp,
      });
    };

    socket.on("traffic:update", onTraffic);
    socket.on("weather:update", onWeather);
    socket.on("event:notification", onEvent);

    return () => {
      unsubscribe("traffic");
      unsubscribe("weather");
      unsubscribe("events");
      socket.off("traffic:update", onTraffic);
      socket.off("weather:update", onWeather);
      socket.off("event:notification", onEvent);
    };
  }, [socket, subscribe, unsubscribe, addUpdate]);

  if (updates.length === 0) {
    return null;
  }

  return (
    <div
      className="fade-enter fixed left-4 right-4 top-16 z-40 w-auto md:left-auto md:right-4 md:top-4 md:w-[min(20rem,calc(100vw-2rem))]"
      suppressHydrationWarning
    >
      <div className="overlay-surface rounded-xl p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-[0.08em] uppercase">Actualizaciones</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isConnected ? "Conectado" : "Reconectando"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="focus-ring interactive-soft h-7 px-2 text-xs hover:bg-muted/60"
            onClick={() => setUpdates([])}
          >
            Limpiar
          </Button>
        </div>

        <div className="minimal-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
          {updates.map((update) => (
            <div key={update.id} className="fade-enter group rounded-lg border border-border/60 bg-background/80 p-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", LEVEL_CLASS[update.level])}>
                  {SOURCE_LABEL[update.source]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(update.timestamp).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => setUpdates((prev) => prev.filter((item) => item.id !== update.id))}
                  className="focus-ring interactive-soft ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  title="Eliminar actualización"
                  aria-label="Eliminar actualización"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-foreground/90">{update.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

