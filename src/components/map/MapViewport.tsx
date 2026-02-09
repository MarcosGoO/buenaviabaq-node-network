"use client"

import * as React from "react"
import Map, { NavigationControl, Marker, Popup, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TimeTraveler } from "@/components/ui/time-traveler"
import { AlertsPanel } from "@/components/panels/AlertsPanel"
import { MapPin, Navigation2 } from "lucide-react"
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

// Mock traffic data - will be replaced with real backend data
const MOCK_TRAFFIC_POINTS = [
    { id: 1, lng: -74.7964, lat: 10.9639, speed: 42, status: 'medium', name: 'Vía 40' },
    { id: 2, lng: -74.7850, lat: 10.9920, speed: 15, status: 'severe', name: 'Calle 72' },
    { id: 3, lng: -74.7910, lat: 11.0100, speed: 55, status: 'free', name: 'Carrera 38' },
]

export function MapViewport() {
    const [viewState, setViewState] = React.useState(BARRANQUILLA_COORDS)
    const [selectedPoint, setSelectedPoint] = React.useState<typeof MOCK_TRAFFIC_POINTS[0] | null>(null)
    const mapRef = React.useRef<any>(null)

    const getTrafficColor = (status: string) => {
        switch (status) {
            case 'free': return 'bg-emerald-500'
            case 'medium': return 'bg-amber-500'
            case 'congested': return 'bg-orange-500'
            case 'severe': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    const recenterMap = () => {
        setViewState(BARRANQUILLA_COORDS)
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
                <NavigationControl position="top-right" showCompass={false} />

                {/* Traffic Markers - Mock data */}
                {MOCK_TRAFFIC_POINTS.map((point) => (
                    <Marker
                        key={point.id}
                        longitude={point.lng}
                        latitude={point.lat}
                        anchor="center"
                        onClick={(e) => {
                            e.originalEvent.stopPropagation()
                            setSelectedPoint(point)
                        }}
                    >
                        <div className={`${getTrafficColor(point.status)} w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform animate-pulse`} />
                    </Marker>
                ))}

                {/* Popup on click */}
                {selectedPoint && (
                    <Popup
                        longitude={selectedPoint.lng}
                        latitude={selectedPoint.lat}
                        anchor="bottom"
                        onClose={() => setSelectedPoint(null)}
                        closeOnClick={false}
                        className="custom-popup"
                    >
                        <div className="p-2 min-w-[180px]">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                <h3 className="font-bold text-sm">{selectedPoint.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                                Current Speed: <span className="font-bold text-foreground">{selectedPoint.speed} km/h</span>
                            </p>
                            <div className="flex items-center gap-1">
                                <div className={`${getTrafficColor(selectedPoint.status)} w-2 h-2 rounded-full`} />
                                <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                                    {selectedPoint.status}
                                </span>
                            </div>
                        </div>
                    </Popup>
                )}
            </Map>

            {/* Recenter button */}
            <Button
                size="icon"
                variant="outline"
                className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-md border-2 hover:scale-110 transition-all"
                onClick={recenterMap}
            >
                <Navigation2 className="h-4 w-4" />
            </Button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pointer-events-auto">
                <TimeTraveler />
            </div>

            {/* Top Left Overlay for Alerts */}
            <AlertsPanel />

            {/* Bottom right branding - fixed positioning */}
            <div className="absolute bottom-4 right-4 text-[9px] text-muted-foreground/50 font-medium tracking-wider pointer-events-none select-none">
                BUENAVIA-BAQ © 2026
            </div>
        </div>
    )
}
