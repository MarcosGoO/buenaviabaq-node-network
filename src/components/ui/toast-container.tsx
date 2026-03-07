"use client";

import * as React from "react";
import { X, Droplets, AlertTriangle, Cloud, Calendar, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Toast } from "@/hooks/useNotifications";

const ALERT_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  arroyo_flood_risk:       { icon: Droplets,      color: 'text-amber-600', bg: 'bg-amber-500/15',  border: 'border-amber-500/40' },
  severe_congestion:       { icon: AlertTriangle,  color: 'text-red-600',   bg: 'bg-red-500/15',    border: 'border-red-500/40' },
  weather_traffic_impact:  { icon: Cloud,          color: 'text-blue-600',  bg: 'bg-blue-500/15',   border: 'border-blue-500/40' },
  event_traffic_impact:    { icon: Calendar,       color: 'text-indigo-600',bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
};

const DEFAULT_STYLE = { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-border' };

const SEVERITY_COLOR: Record<string, string> = {
  low:    'text-slate-500',
  medium: 'text-yellow-600',
  high:   'text-orange-600',
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

  // Animate in on mount
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 w-80 rounded-xl border px-4 py-3 shadow-lg",
        "bg-background/95 backdrop-blur-xl",
        "transition-all duration-300 ease-out",
        style.border,
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      )}
    >
      <div className={cn("mt-0.5 shrink-0 rounded-lg p-1.5", style.bg)}>
        <Icon className={cn("h-3.5 w-3.5", style.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn("text-[11px] font-bold truncate", style.color)}>
            {alert.title}
          </span>
          <span className={cn("text-[9px] font-semibold shrink-0 uppercase tracking-wide", SEVERITY_COLOR[alert.severity])}>
            {alert.severity}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {alert.description}
        </p>
      </div>

      <button
        onClick={() => onDismiss(alert.id)}
        className="shrink-0 mt-0.5 rounded-full p-0.5 hover:bg-muted/60 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  permissionState: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
}

export function ToastContainer({ toasts, onDismiss, permissionState, onRequestPermission }: ToastContainerProps) {
  return (
    <>
      {/* Permission nudge — shown once when permission is 'default' and there are alerts incoming */}
      {permissionState === 'default' && (
        <div className="fixed bottom-20 right-4 z-[60] w-72 rounded-xl border border-border bg-background/95 backdrop-blur-xl px-4 py-3 shadow-lg flex items-start gap-3">
          <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground mb-1">
              Enable browser notifications
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              Receive alerts for critical traffic events even when the panel is closed.
            </p>
            <button
              onClick={onRequestPermission}
              className="text-[10px] font-semibold text-primary hover:underline"
            >
              Allow notifications
            </button>
          </div>
        </div>
      )}

      {/* Toast stack — bottom-right */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
