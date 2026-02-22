"use client"

import * as React from "react"
import { Bell, ChevronLeft, Droplets, AlertTriangle, Cloud, Calendar, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAlerts, type Alert } from "@/hooks/useAlerts"

// Alert type → icon + color
const ALERT_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  arroyo_flood_risk: { icon: Droplets, color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  severe_congestion: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  weather_traffic_impact: { icon: Cloud, color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  event_traffic_impact: { icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
}

const DEFAULT_STYLE = { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-border' }

const SEVERITY_LABEL: Record<string, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const style = ALERT_STYLES[alert.type] ?? DEFAULT_STYLE
  const Icon = style.icon

  return (
    <Card className={cn(
      "w-80 bg-background/95 backdrop-blur-xl shadow-2xl transition-all hover:translate-x-1 duration-300 overflow-hidden group relative",
      style.border
    )}>
      <CardHeader className="p-4 pb-2 relative">
        <CardTitle className="text-xs font-black flex items-center justify-between tracking-wider uppercase">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", style.bg)}>
              <Icon className={cn("h-3.5 w-3.5", style.color)} />
            </div>
            <span className={style.color}>{alert.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn("text-[9px] font-medium opacity-60", style.color)}>
              {SEVERITY_LABEL[alert.severity]}
            </span>
            <button
              onClick={() => onDismiss(alert.id)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted/50 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 relative">
        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
          {alert.description}
        </p>
      </CardContent>
    </Card>
  )
}

export function AlertsPanel() {
    const [isOpen, setIsOpen] = React.useState(false)
    const { alerts, dismissAlert, clearAll } = useAlerts()

    const hasAlerts = alerts.length > 0
    // Show at most 4 alerts to avoid overflow
    const visibleAlerts = alerts.slice(0, 4)

    return (
        <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col gap-3 transition-all duration-300 ease-in-out" suppressHydrationWarning>
            {/* Toggle Button when closed */}
            <div
                className={cn(
                    "transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    isOpen ? "opacity-0 scale-90 h-0 w-0 overflow-hidden" : "opacity-100 scale-100 h-11 w-11"
                )}
                suppressHydrationWarning
            >
                <Button
                    size="icon"
                    className="h-11 w-11 rounded-full shadow-2xl bg-background/90 backdrop-blur-md hover:bg-background border-2 border-primary/20 transition-all hover:scale-110 active:scale-95"
                    onClick={() => setIsOpen(true)}
                >
                    <div className="relative" suppressHydrationWarning>
                        <Bell className="h-5 w-5 text-primary" />
                        {hasAlerts && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                        )}
                    </div>
                </Button>
            </div>

            {/* Expanded Panel */}
            <div
                className={cn(
                    "flex flex-col gap-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top-left",
                    isOpen ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-4 pointer-events-none h-0"
                )}
                suppressHydrationWarning
            >
                <div className="flex items-center justify-between px-2 mb-1" suppressHydrationWarning>
                    <div className="flex items-center gap-2" suppressHydrationWarning>
                        <div className="h-1 w-1 bg-primary rounded-full animate-pulse" suppressHydrationWarning />
                        <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-70">
                            Live Intelligence
                        </span>
                        {hasAlerts && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                            {alerts.length}
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {hasAlerts && (
                          <button
                            onClick={clearAll}
                            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors mr-1"
                          >
                            Clear all
                          </button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-muted/80 transition-all hover:rotate-180"
                            onClick={() => setIsOpen(false)}
                        >
                            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Live alert cards */}
                {visibleAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
                ))}

                {/* Empty state */}
                {!hasAlerts && (
                  <Card className="w-80 bg-background/95 backdrop-blur-xl border border-border/50 shadow-lg">
                    <CardContent className="p-6 text-center">
                      <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-muted-foreground">No active alerts</p>
                    </CardContent>
                  </Card>
                )}
            </div>
        </div>
    )
}
