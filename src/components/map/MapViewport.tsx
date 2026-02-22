"use client"

import * as React from "react"
import Map, { NavigationControl, type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TimeTraveler } from "@/components/ui/time-traveler"
import { AlertsPanel } from "@/components/panels/AlertsPanel"
import { TrafficLayer } from "@/components/map/TrafficLayer"
import { Navigation2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const BARRANQUILLA_COORDS = {
    longitude: -74.7964,
    latitude: 10.9639,
    zoom: 12,
    pitch: 0,
    bearing: 0
}

const ATLANTICO_BOUNDS: [number, number, number, number] = [
    -75.25, 10.15, // Southwest (Long, Lat) - Near Galapa/Usiacurí
    -74.55, 11.15  // Northeast (Long, Lat) - Past Puerto Colombia/River
]

export function MapViewport() {
    const [viewState, setViewState] = React.useState(BARRANQUILLA_COORDS)
    const [simulatedHour, setSimulatedHour] = React.useState<number | null>(null)
    const mapRef = React.useRef<MapRef>(null)

    const recenterMap = () => {
        setViewState(BARRANQUILLA_COORDS)
    }

    // When the user moves the slider, simulate historical data for that hour.
    // null = live mode (current real data)
    const handleTimeChange = (hour: number) => {
        const currentHour = new Date().getHours()
        setSimulatedHour(hour === currentHour ? null : hour)
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-slate-100">
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
                <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />
            </Map>

            {/* Recenter button - repositioned above zoom controls */}
            <Button
                size="icon"
                variant="outline"
                className="absolute bottom-32 right-4 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-md border-2 hover:scale-110 transition-all z-10"
                onClick={recenterMap}
                title="Recenter map"
            >
                <Navigation2 className="h-4 w-4" />
            </Button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pointer-events-auto">
                <TimeTraveler onTimeChange={handleTimeChange} />
            </div>

            {/* Time simulation indicator */}
            {simulatedHour !== null && (
                <div className="absolute top-4 right-4 z-10 bg-amber-500/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm tracking-wider uppercase">
                    Historical — {simulatedHour}:00
                </div>
            )}

            {/* Top Left Overlay for Alerts */}
            <AlertsPanel />

            {/* Bottom left branding - fixed positioning */}
            <div className="absolute bottom-4 left-4 text-[9px] text-muted-foreground/50 font-medium tracking-wider pointer-events-none select-none" suppressHydrationWarning>
                BUENAVIA-BAQ © 2026
            </div>
        </div>
    )
}
