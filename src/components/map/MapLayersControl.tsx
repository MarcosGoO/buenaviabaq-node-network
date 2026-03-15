"use client";

import { Layers } from "lucide-react";
import type { LayerVisibilityState } from "@/components/map/TrafficOverlays";

interface MapLayersControlProps {
  layers: LayerVisibilityState;
  onToggle: (layer: keyof LayerVisibilityState) => void;
}

const LABELS: Record<keyof LayerVisibilityState, string> = {
  zones: "Localidades",
  roads: "Corredores",
  hotspots: "Hotspots",
  arroyos: "Arroyos",
  events: "Eventos",
};

export function MapLayersControl({ layers, onToggle }: MapLayersControlProps) {
  return (
    <div className="absolute right-4 top-4 z-30 w-52 rounded-xl border border-border/70 bg-background/90 p-3 shadow-md backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/80">
        <Layers className="h-4 w-4" />
        Capas
      </div>
      <div className="space-y-1.5">
        {Object.keys(LABELS).map((keyRaw) => {
          const key = keyRaw as keyof LayerVisibilityState;
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/60"
            >
              <span>{LABELS[key]}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={layers[key]}
                onChange={() => onToggle(key)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

