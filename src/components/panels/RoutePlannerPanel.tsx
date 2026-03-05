"use client"

import * as React from "react"
import {
  MapPin, Navigation2, Loader2, RotateCcw, ChevronRight,
  AlertTriangle, Clock, Gauge, Route, X, ChevronLeft,
  Droplets, Wind, Shield
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouting, type Route as CalcRoute, type RouteCoord } from "@/hooks/useRouting"

// ─── Barranquilla landmark presets ────────────────────────────────────────────
const PRESETS: { label: string; coord: RouteCoord }[] = [
  { label: "Centro histórico", coord: { lat: 10.9878, lng: -74.7889 } },
  { label: "El Prado", coord: { lat: 11.0028, lng: -74.8063 } },
  { label: "Boca Grande", coord: { lat: 11.0189, lng: -74.8196 } },
  { label: "Vía 40", coord: { lat: 10.9985, lng: -74.7968 } },
  { label: "Aeropuerto", coord: { lat: 10.8896, lng: -74.7808 } },
  { label: "Carulla Buenavista", coord: { lat: 11.0312, lng: -74.8275 } },
]

// ─── Score colour helper ───────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600"
  if (score >= 50) return "text-amber-500"
  return "text-red-500"
}

function scoreBg(score: number) {
  if (score >= 75) return "bg-emerald-500/10 border-emerald-500/30"
  if (score >= 50) return "bg-amber-500/10 border-amber-500/30"
  return "bg-red-500/10 border-red-500/30"
}

// ─── Coord input with presets ──────────────────────────────────────────────────
function CoordInput({
  label,
  icon: Icon,
  iconColor,
  value,
  onChange,
}: {
  label: string
  icon: React.ElementType
  iconColor: string
  value: RouteCoord | null
  onChange: (c: RouteCoord) => void
}) {
  const [showPresets, setShowPresets] = React.useState(false)

  const selectedLabel = value
    ? PRESETS.find(p => p.coord.lat === value.lat && p.coord.lng === value.lng)?.label
    : null

  return (
    <div className="relative">
      <button
        onClick={() => setShowPresets(v => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all",
          "bg-background/80 hover:bg-muted/60 text-xs font-medium",
          value ? "border-border/60" : "border-dashed border-border/40 text-muted-foreground",
          showPresets && "ring-1 ring-primary/30 border-primary/30"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", value ? iconColor : "text-muted-foreground/50")} />
        <span className="truncate">{selectedLabel ?? label}</span>
        <ChevronRight className={cn("h-3 w-3 ml-auto shrink-0 text-muted-foreground/50 transition-transform", showPresets && "rotate-90")} />
      </button>

      {showPresets && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border bg-background/98 backdrop-blur-xl shadow-2xl overflow-hidden">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { onChange(p.coord); setShowPresets(false) }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-muted/60 flex items-center gap-2 transition-colors"
            >
              <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Route card ────────────────────────────────────────────────────────────────
function RouteCard({
  route,
  index,
  isSelected,
  onSelect,
}: {
  route: CalcRoute
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  const labels = ["Mejor ruta", "Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4"]

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all duration-200",
        isSelected
          ? "bg-primary/5 border-primary/40 shadow-sm"
          : "bg-background/60 border-border/40 hover:bg-muted/40 hover:border-border/60"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">
          {labels[index] ?? `Ruta ${index + 1}`}
        </span>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold", scoreBg(route.overall_score))}>
          <span className={scoreColor(route.overall_score)}>{route.overall_score}</span>
          <span className="text-muted-foreground/50">/100</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-xs font-semibold">{Math.round(route.estimated_time_minutes)} min</span>
        </div>
        <div className="flex items-center gap-1">
          <Route className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-xs font-semibold">{route.total_distance_km.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-1">
          <Gauge className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-xs font-semibold">{Math.round(route.average_speed_kmh)} km/h</span>
        </div>
      </div>

      {/* Score breakdown mini-bars */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        {[
          { label: "Tráfico", value: route.score_breakdown.traffic_score },
          { label: "Clima", value: route.score_breakdown.weather_score },
          { label: "Seguridad", value: route.score_breakdown.safety_score },
          { label: "Distancia", value: route.score_breakdown.distance_score },
        ].map(s => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="text-[8px] text-muted-foreground/60 text-center">{s.label}</span>
            <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", s.value >= 75 ? "bg-emerald-500" : s.value >= 50 ? "bg-amber-400" : "bg-red-400")}
                style={{ width: `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Flags */}
      <div className="flex items-center gap-2 flex-wrap">
        {route.metadata.arroyo_risk && (
          <span className="flex items-center gap-1 text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            <Droplets className="h-2.5 w-2.5" /> Arroyo
          </span>
        )}
        {route.metadata.weather_affected && (
          <span className="flex items-center gap-1 text-[9px] font-medium text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
            <Wind className="h-2.5 w-2.5" /> Clima
          </span>
        )}
        {route.metadata.congested_segments > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-medium text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="h-2.5 w-2.5" /> {route.metadata.congested_segments} seg. congestionado{route.metadata.congested_segments > 1 ? "s" : ""}
          </span>
        )}
        {!route.metadata.arroyo_risk && !route.metadata.weather_affected && route.metadata.congested_segments === 0 && (
          <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            <Shield className="h-2.5 w-2.5" /> Sin incidencias
          </span>
        )}
      </div>

      {/* Warnings */}
      {route.warnings.length > 0 && (
        <div className="mt-2 border-t border-border/20 pt-2">
          {route.warnings.slice(0, 2).map((w, i) => (
            <p key={i} className="text-[9px] text-amber-600/80 leading-relaxed">⚠ {w}</p>
          ))}
        </div>
      )}
    </button>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────────
interface RoutePlannerPanelProps {
  onRouteSelect?: (route: CalcRoute | null) => void
}

export function RoutePlannerPanel({ onRouteSelect }: RoutePlannerPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [origin, setOrigin] = React.useState<RouteCoord | null>(null)
  const [destination, setDestination] = React.useState<RouteCoord | null>(null)
  const [avoidArroyos, setAvoidArroyos] = React.useState(true)
  const [avoidCongestion, setAvoidCongestion] = React.useState(true)

  const { routes, selectedRoute, isLoading, error, calculateRoutes, selectRoute, clearRoutes } = useRouting()

  const handleCalculate = async () => {
    if (!origin || !destination) return
    await calculateRoutes(origin, destination, {
      avoid_arroyos: avoidArroyos,
      avoid_congestion: avoidCongestion,
    })
  }

  const handleSelectRoute = (route: CalcRoute) => {
    selectRoute(route)
    onRouteSelect?.(route)
  }

  const handleClear = () => {
    clearRoutes()
    setOrigin(null)
    setDestination(null)
    onRouteSelect?.(null)
  }

  const canCalculate = !!origin && !!destination && !isLoading

  return (
    <div className="absolute top-4 right-16 z-40 pointer-events-auto" suppressHydrationWarning>
      {/* Toggle button */}
      {!isOpen && (
        <Button
          size="icon"
          className="h-11 w-11 rounded-full shadow-2xl bg-background/90 backdrop-blur-md hover:bg-background border-2 border-primary/20 transition-all hover:scale-110 active:scale-95"
          onClick={() => setIsOpen(true)}
          title="Planificar ruta"
        >
          <Navigation2 className="h-5 w-5 text-primary" />
        </Button>
      )}

      {/* Panel */}
      {isOpen && (
        <Card className="w-80 bg-background/95 backdrop-blur-xl shadow-2xl border border-border/50">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 bg-primary rounded-full animate-pulse" />
                Planificador de Ruta
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-muted/80 -mr-1"
                onClick={() => { setIsOpen(false); handleClear() }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-3">
            {/* Origin / Destination pickers */}
            <div className="space-y-2">
              <CoordInput
                label="Selecciona origen…"
                icon={MapPin}
                iconColor="text-emerald-500"
                value={origin}
                onChange={setOrigin}
              />
              <div className="flex justify-center">
                <ChevronLeft className="h-4 w-4 text-muted-foreground/30 -rotate-90" />
              </div>
              <CoordInput
                label="Selecciona destino…"
                icon={MapPin}
                iconColor="text-red-500"
                value={destination}
                onChange={setDestination}
              />
            </div>

            {/* Preferences */}
            <div className="flex gap-2">
              <button
                onClick={() => setAvoidArroyos(v => !v)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all",
                  avoidArroyos
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
                    : "bg-muted/30 border-border/30 text-muted-foreground/60"
                )}
              >
                <Droplets className="h-3 w-3" />
                Sin arroyos
              </button>
              <button
                onClick={() => setAvoidCongestion(v => !v)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all",
                  avoidCongestion
                    ? "bg-red-500/10 border-red-500/40 text-red-600"
                    : "bg-muted/30 border-border/30 text-muted-foreground/60"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Sin tráfico
              </button>
            </div>

            {/* Action button */}
            <Button
              onClick={handleCalculate}
              disabled={!canCalculate}
              className="w-full h-9 text-xs font-bold tracking-wide"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Calculando…
                </>
              ) : (
                <>
                  <Navigation2 className="h-3.5 w-3.5 mr-2" />
                  Calcular rutas
                </>
              )}
            </Button>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-red-600 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Route results */}
            {routes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black tracking-[0.15em] uppercase text-muted-foreground/70">
                    {routes.length} ruta{routes.length > 1 ? "s" : ""} encontrada{routes.length > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Limpiar
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {routes.map((route, i) => (
                    <RouteCard
                      key={route.route_id}
                      route={route}
                      index={i}
                      isSelected={selectedRoute?.route_id === route.route_id}
                      onSelect={() => handleSelectRoute(route)}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
