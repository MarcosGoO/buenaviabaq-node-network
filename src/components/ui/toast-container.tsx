"use client";

import * as React from "react";
import { X, Droplets, AlertTriangle, Cloud, Calendar, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Toast } from "@/hooks/useNotifications";

const ALERT_STYLES: Record<string, { icon: React.ElementType; text: string; bg: string; border: string }> = {
  arroyo_flood_risk: {
    icon: Droplets,
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/35",
  },
  severe_congestion: {
    icon: AlertTriangle,
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/15",
    border: "border-red-500/35",
  },
  weather_traffic_impact: {
    icon: Cloud,
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-500/15",
    border: "border-sky-500/35",
  },
  event_traffic_impact: {
    icon: Calendar,
    text: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-500/15",
    border: "border-indigo-500/35",
  },
};

const DEFAULT_STYLE = {
  icon: AlertTriangle,
  text: "text-muted-foreground",
  bg: "bg-muted/60",
  border: "border-border",
};

const SEVERITY_STYLE: Record<string, string> = {
  low: "text-sky-700 dark:text-sky-300",
  medium: "text-amber-700 dark:text-amber-300",
  high: "text-red-700 dark:text-red-300",
  critical: "text-red-800 dark:text-red-200",
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { alert } = toast;
  const style = ALERT_STYLES[alert.type] ?? DEFAULT_STYLE;
  const Icon = style.icon;

  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex w-80 items-start gap-3 rounded-xl border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur",
        "transition-all duration-200 ease-out",
        style.border,
        visible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
      )}
    >
      <div className={cn("mt-0.5 shrink-0 rounded-md p-1.5", style.bg)}>
        <Icon className={cn("h-3.5 w-3.5", style.text)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className={cn("truncate text-xs font-semibold", style.text)}>{alert.title}</span>
          <span className={cn("shrink-0 text-[10px] font-semibold uppercase", SEVERITY_STYLE[alert.severity])}>
            {alert.severity}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{alert.description}</p>
      </div>

      <button
        onClick={() => onDismiss(alert.id)}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Descartar notificación"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  permissionState: NotificationPermission | "unsupported";
  onRequestPermission: () => void;
}

export function ToastContainer({ toasts, onDismiss, permissionState, onRequestPermission }: ToastContainerProps) {
  return (
    <>
      {permissionState === "default" && (
        <div className="fixed bottom-20 right-4 z-[60] flex w-72 items-start gap-3 rounded-xl border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold text-foreground">Activar notificaciones del navegador</p>
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
              Recibe alertas críticas aunque el panel esté cerrado.
            </p>
            <button onClick={onRequestPermission} className="text-[11px] font-semibold text-primary hover:underline">
              Permitir notificaciones
            </button>
          </div>
        </div>
      )}

      <div aria-label="Notificaciones" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}

