"use client"

import * as React from "react"
import { Cloud, CloudRain, Sun, Wind, Droplets } from "lucide-react"
import { cn } from "@/lib/utils"

interface WeatherWidgetProps extends React.HTMLAttributes<HTMLDivElement> { }

// Mock weather data - will be replaced with real API
const MOCK_WEATHER = {
    temp: 32,
    condition: 'partly-cloudy',
    humidity: 72,
    windSpeed: 18,
    location: 'Barranquilla',
    rainChance: 40
}

export function WeatherWidget({ className, ...props }: WeatherWidgetProps) {
    const getWeatherIcon = (condition: string) => {
        switch (condition) {
            case 'sunny':
                return <Sun className="h-6 w-6 text-amber-500" />
            case 'rainy':
                return <CloudRain className="h-6 w-6 text-blue-500" />
            case 'partly-cloudy':
            default:
                return <Cloud className="h-6 w-6 text-slate-400" />
        }
    }

    return (
        <div
            className={cn(
                "bg-background/90 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl p-4",
                "transition-all duration-300 hover:shadow-3xl hover:border-primary/20",
                className
            )}
            {...props}
            suppressHydrationWarning
        >
            {/* Location & Icon */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                        Weather
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                        {MOCK_WEATHER.location}
                    </p>
                </div>
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                    {getWeatherIcon(MOCK_WEATHER.condition)}
                </div>
            </div>

            {/* Temperature */}
            <div className="mb-3">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight">
                        {MOCK_WEATHER.temp}
                    </span>
                    <span className="text-lg text-muted-foreground">°C</span>
                </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                <div className="flex flex-col items-center gap-1">
                    <Droplets className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-bold text-foreground">
                        {MOCK_WEATHER.humidity}%
                    </span>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                        Humidity
                    </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Wind className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-foreground">
                        {MOCK_WEATHER.windSpeed}
                    </span>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                        km/h
                    </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <CloudRain className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-[10px] font-bold text-foreground">
                        {MOCK_WEATHER.rainChance}%
                    </span>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                        Rain
                    </span>
                </div>
            </div>
        </div>
    )
}
