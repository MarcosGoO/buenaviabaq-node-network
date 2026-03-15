"use client"

import * as React from "react"
import Map, { NavigationControl, Source, Layer, type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TimeTraveler } from "@/components/ui/time-traveler"
import { AlertsPanel } from "@/components/panels/AlertsPanel"
import { TrafficLayer } from "@/components/map/TrafficLayer"
import { RoutePlannerPanel } from "@/components/panels/RoutePlannerPanel"
import { ChevronDown, ChevronUp, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Route } from "@/hooks/useRouting"

const BARRANQUILLA_COORDS = {
    longitude: -74.7964,
    latitude: 10.9639,
    zoom: 12,
    pitch: 0,
    bearing: 0
}

const ATLANTICO_BOUNDS: [number, number, number, number] = [
    -75.25, 10.15, // Southwest (Long, Lat) - Near Galapa/UsiacurÃ­
    -74.55, 11.15  // Northeast (Long, Lat) - Past Puerto Colombia/River
]

const TIME_PANEL_STORAGE_KEY = "viabaq:time-panel-open"

// Build a GeoJSON FeatureCollection from route segments
function routeToGeoJSON(route: Route): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = route.segments
        .filter(s => s.geometry?.type === 'LineString' && Array.isArray(s.geometry.coordinates))
        .map(s => ({
            type: 'Feature' as const,
            properties: { congestion_level: s.congestion_level, road_name: s.road_name },
            geometry: s.geometry as GeoJSON.LineString,
        }))
    return { type: 'FeatureCollection', features }
}

export function MapViewport() {
    const [viewState, setViewState] = React.useState(BARRANQUILLA_COORDS)
    const [simulatedHour, setSimulatedHour] = React.useState<number | null>(null)
    const [activeRoute, setActiveRoute] = React.useState<Route | null>(null)
    const [isTimeTravelerOpen, setIsTimeTravelerOpen] = React.useState(true)
    const [isTimePanelReady, setIsTimePanelReady] = React.useState(false)
    const mapRef = React.useRef<MapRef>(null)

    const recenterMap = () => {
        setViewState(BARRANQUILLA_COORDS)
    }

    // When the user moves the slider, simulate historical data for that hour.
    // null = live mode (current real data)
    const handleTimeChange = React.useCallback((hour: number) => {
        const currentHour = new Date().getHours()
        setSimulatedHour(hour === currentHour ? null : hour)
    }, [])

    React.useEffect(() => {
        try {
            const stored = window.localStorage.getItem(TIME_PANEL_STORAGE_KEY)
            if (stored === "0") {
                setIsTimeTravelerOpen(false)
            } else if (stored === "1") {
                setIsTimeTravelerOpen(true)
            }
        } catch {
            // Ignore localStorage read issues and keep default state.
        } finally {
            setIsTimePanelReady(true)
        }
    }, [])

    React.useEffect(() => {
        if (!isTimePanelReady) return
        try {
            window.localStorage.setItem(TIME_PANEL_STORAGE_KEY, isTimeTravelerOpen ? "1" : "0")
        } catch {
            // Ignore localStorage write issues.
        }
    }, [isTimeTravelerOpen, isTimePanelReady])

    const routeGeoJSON = activeRoute ? routeToGeoJSON(activeRoute) : null

    return (
        <div className="relative h-full w-full overflow-hidden bg-background">
            <Map
                ref={mapRef}
                {...viewState}
                onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
                mapLib={maplibregl}
                maxBounds={ATLANTICO_BOUNDS}
                minZoom={10}
                maxZoom={18}
                attributionControl={false}
                reuseMaps
            >
                <TrafficLayer simulatedHour={simulatedHour} />

                {/* Route overlay â€” drawn on top of traffic layer */}
                {routeGeoJSON && (
                    <Source id="active-route" type="geojson" data={routeGeoJSON}>
                        {/* Casing (white outline for contrast) */}
                        <Layer
                            id="route-casing"
                            type="line"
                            paint={{
                                'line-color': '#ffffff',
                                'line-width': 10,
                                'line-opacity': 0.8,
                            }}
                            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                        />
                        {/* Main route line */}
                        <Layer
                            id="route-line"
                            type="line"
                            paint={{
                                'line-color': '#6366f1',
                                'line-width': 5,
                                'line-opacity': 0.95,
                            }}
                            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                        />
                    </Source>
                )}

                <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />
            </Map>

            {/* Recenter button - repositioned above zoom controls */}
            <Button
                size="icon"
                variant="outline"
                className="absolute bottom-32 right-4 h-10 w-10 rounded-full border bg-card/95 shadow-sm transition-colors z-10"
                onClick={recenterMap}
                title="Recentrar mapa"
                aria-label="Recentrar mapa"
            >
                <LocateFixed className="h-4 w-4" />
            </Button>

            <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-4 pb-3">
                <div className="flex flex-col items-center gap-2">
                    <div
                        id="time-simulation-panel"
                        className={[
                            "w-full overflow-hidden origin-bottom transition-all duration-300 ease-out",
                            isTimePanelReady && isTimeTravelerOpen
                                ? "max-h-[420px] translate-y-0 scale-100 opacity-100 pointer-events-auto"
                                : "max-h-0 translate-y-6 scale-[0.98] opacity-0 pointer-events-none",
                        ].join(" ")}
                    >
                        <TimeTraveler onTimeChange={handleTimeChange} />
                    </div>

                    <button
                        type="button"
                        aria-controls="time-simulation-panel"
                        aria-expanded={isTimeTravelerOpen}
                        onClick={() => setIsTimeTravelerOpen((prev) => !prev)}
                        className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/75 px-2.5 text-[11px] font-medium text-foreground shadow-[0_8px_24px_-16px_hsl(var(--foreground)/0.55)] backdrop-blur-md transition-all duration-200 hover:bg-background/90 hover:border-border sm:h-8 sm:px-3"
                    >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                            {isTimeTravelerOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </span>
                        <span className="sm:hidden">{isTimeTravelerOpen ? "Ocultar" : "Mostrar"}</span>
                        <span className="hidden sm:inline">{isTimeTravelerOpen ? "Ocultar simulacion" : "Mostrar simulacion"}</span>
                    </button>
                </div>
            </div>

            {/* Top Left Overlay for Alerts */}
            <AlertsPanel />

            {/* Top Right Overlay Stack */}
            <div className="pointer-events-none absolute right-4 top-4 z-40 flex flex-col items-end gap-2">
                <RoutePlannerPanel className="pointer-events-auto" onRouteSelect={setActiveRoute} />
                {simulatedHour !== null && (
                    <div className="pointer-events-auto rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 shadow-sm dark:text-amber-300">
                        Historical - {simulatedHour}:00
                    </div>
                )}
            </div>

            {/* Bottom left branding - fixed positioning */}
            <div className="absolute bottom-4 left-4 text-[9px] text-muted-foreground/50 font-medium tracking-wider pointer-events-none select-none" suppressHydrationWarning>
                BUENAVIA-BAQ (C) 2026
            </div>
        </div>
    )
}






