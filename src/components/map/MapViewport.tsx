"use client"

import * as React from "react"
import Map, { NavigationControl, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TimeTraveler } from "@/components/ui/time-traveler"
import { AlertsPanel } from "@/components/panels/AlertsPanel"

const BARRANQUILLA_COORDS = {
    longitude: -74.7964,
    latitude: 10.9639,
    zoom: 12
}

export function MapViewport() {
    const [viewState, setViewState] = React.useState(BARRANQUILLA_COORDS)

    return (
        <div className="relative h-full w-full overflow-hidden">
            <Map
                {...viewState}
                onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                mapLib={maplibregl}
            >
                <NavigationControl position="top-right" />

                {/* Placeholder for Traffic/Arroyo Data */}
            </Map>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pointer-events-auto">
                <TimeTraveler />
            </div>

            {/* Top Left Overlay for Alerts */}
            <AlertsPanel />
        </div>
    )
}
