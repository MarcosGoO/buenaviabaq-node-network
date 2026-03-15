"use client";

import * as React from "react";
import { Bell, ChevronLeft, Droplets, AlertTriangle, Cloud, Calendar, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAlerts, type Alert } from "@/hooks/useAlerts";
import { useSettings } from "@/hooks/useSettings";
import { useNotifications } from "@/hooks/useNotifications";
import { ToastContainer } from "@/components/ui/toast-container";

type NotificationLevel = "info" | "success" | "warning" | "error" | "critical";

const ALERT_STYLES: Record<string, { icon: React.ElementType; level: NotificationLevel }> = {
  arroyo_flood_risk: { icon: Droplets, level: "warning" },
  severe_congestion: { icon: AlertTriangle, level: "error" },
  weather_traffic_impact: { icon: Cloud, level: "info" },
  event_traffic_impact: { icon: Calendar, level: "info" },
};

const DEFAULT_STYLE = { icon: AlertTriangle, level: "warning" as NotificationLevel };

const LEVEL_STYLE: Record<NotificationLevel, { text: string; bg: string; border: string; badge: string }> = {
  info: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  success: {
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  error: {
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  critical: {
    text: "text-red-800 dark:text-red-200",
    bg: "bg-red-500/15",
    border: "border-red-500/45",
    badge: "bg-red-500/20 text-red-800 dark:text-red-200",
  },
};

const SEVERITY_LABEL: Record<Alert["severity"], NotificationLevel> = {
  low: "info",
  medium: "warning",
  high: "error",
  critical: "critical",
};

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const mappedLevel: NotificationLevel = SEVERITY_LABEL[alert.severity];
  const styleConfig = ALERT_STYLES[alert.type] ?? DEFAULT_STYLE;
  const level = alert.severity === "critical" ? "critical" : mappedLevel ?? styleConfig.level;
  const levelStyle = LEVEL_STYLE[level];
  const Icon = styleConfig.icon;

  return (
    <Card className={cn("w-80 border bg-card/95 shadow-sm backdrop-blur", levelStyle.border)}>
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn("rounded-md p-1.5", levelStyle.bg)}>
              <Icon className={cn("h-3.5 w-3.5", levelStyle.text)} />
            </div>
            <span className={cn("truncate", levelStyle.text)}>{alert.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", levelStyle.badge)}>
              {level}
            </span>
            <button
              onClick={() => onDismiss(alert.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Descartar alerta"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{alert.description}</p>
      </CardContent>
    </Card>
  );
}

export function AlertsPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { alerts, dismissAlert, clearAll } = useAlerts();
  const { settings } = useSettings();
  const { toasts, dismissToast, permissionState, requestPermission } = useNotifications(
    alerts,
    settings.minAlertSeverity,
    settings.showAlerts
  );

  const hasAlerts = alerts.length > 0;
  const visibleAlerts = alerts.slice(0, 4);

  return (
    <>
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        permissionState={permissionState}
        onRequestPermission={requestPermission}
      />

      <div className="pointer-events-auto absolute left-4 top-4 z-50 flex flex-col gap-2" suppressHydrationWarning>
        <div
          className={cn(
            "transition-all duration-300",
            isOpen ? "pointer-events-none h-0 w-0 scale-95 opacity-0" : "h-10 w-10 scale-100 opacity-100"
          )}
        >
          <Button
            size="icon"
            className="h-10 w-10 rounded-full border border-border bg-card/95 shadow-sm backdrop-blur"
            onClick={() => setIsOpen(true)}
          >
            <div className="relative">
              <Bell className="h-4 w-4 text-primary" />
              {hasAlerts && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />}
            </div>
          </Button>
        </div>

        <div
          className={cn(
            "origin-top-left transition-all duration-300",
            isOpen ? "translate-x-0 scale-100 opacity-100" : "pointer-events-none -translate-x-2 scale-95 opacity-0"
          )}
          suppressHydrationWarning
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Alertas</span>
              {hasAlerts && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{alerts.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasAlerts && (
                <button onClick={clearAll} className="text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                  Limpiar
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {visibleAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}

          {!hasAlerts && (
            <Card className="w-80 border bg-card/95 shadow-sm">
              <CardContent className="p-4 text-center">
                <Bell className="mx-auto mb-2 h-5 w-5 text-muted-foreground/70" />
                <p className="text-xs text-muted-foreground">No hay alertas activas</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

