"use client"

import * as React from "react"
import { Cloud, CloudRain, Sun, Wind, Droplets, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
    const [isExpanded, setIsExpanded] = React.useState(false)

    const getWeatherIcon = (condition: string) => {
        switch (condition) {
            case 'sunny':
                return <Sun className="h-5 w-5 text-amber-500" />
            case 'rainy':
                return <CloudRain className="h-5 w-5 text-blue-500" />
            case 'partly-cloudy':
            default:
                return <Cloud className="h-5 w-5 text-slate-400" />
        }
    }

    return (
        <div
            className={cn(
                "bg-background/90 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl",
                "transition-all duration-300 hover:shadow-3xl hover:border-primary/20",
                className
            )}
            {...props}
            suppressHydrationWarning
        >
            {/* Collapsed State - Click to expand */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between hover:bg-accent/50 rounded-2xl transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                        {getWeatherIcon(MOCK_WEATHER.condition)}
                    </div>
                    <div className="text-left">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold tracking-tight">
                                {MOCK_WEATHER.temp}
                            </span>
                            <span className="text-sm text-muted-foreground">°C</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            {MOCK_WEATHER.location}
                        </p>
                    </div>
                </div>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-300",
                        isExpanded && "rotate-180"
                    )}
                />
            </button>

            {/* Expanded State - Additional Details */}
            <div
                className={cn(
                    "grid transition-all duration-300 ease-in-out overflow-hidden",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-3 pb-3">
                        <div className="pt-2 border-t border-border/50" />
                        <div className="grid grid-cols-3 gap-2 pt-3">
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
                </div>
            </div>
        </div>
    )
}
