"use client"

import * as React from "react"
import { Cloud, CloudRain, Sun, Wind, Droplets, CloudDrizzle, CloudFog } from "lucide-react"
import { cn } from "@/lib/utils"

interface WeatherWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
    compact?: boolean
}

interface WeatherData {
    temperature: number
    condition: string
    humidity: number
    wind_speed: number
    rain_probability: number
    location: string
}

export function WeatherWidget({ className, compact = false, ...props }: WeatherWidgetProps) {
    const [weather, setWeather] = React.useState<WeatherData | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function fetchWeather() {
            try {
                const response = await fetch('http://localhost:4000/api/v1/weather/current')
                if (!response.ok) throw new Error('Failed to fetch weather')
                const data = await response.json()
                setWeather(data.data)
            } catch (error) {
                console.error('Weather fetch error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchWeather()
        const interval = setInterval(fetchWeather, 5 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

    const getWeatherIcon = (condition: string) => {
        const cond = condition?.toLowerCase() || ''

        if (cond.includes('clear') || cond.includes('sun')) {
            return <Sun className="h-4 w-4 text-amber-500" />
        }
        if (cond.includes('rain')) {
            return <CloudRain className="h-4 w-4 text-blue-500" />
        }
        if (cond.includes('drizzle')) {
            return <CloudDrizzle className="h-4 w-4 text-blue-400" />
        }
        if (cond.includes('fog') || cond.includes('mist')) {
            return <CloudFog className="h-4 w-4 text-slate-400" />
        }
        return <Cloud className="h-4 w-4 text-slate-400" />
    }

    if (loading) {
        return (
            <div className={cn("animate-pulse bg-muted/50 rounded-lg p-3", className)} {...props}>
                <div className="h-16 bg-muted rounded" />
            </div>
        )
    }

    if (!weather) return null

    if (compact) {
        return (
            <div
                className={cn(
                    "bg-background/50 backdrop-blur-sm rounded-lg border border-border/50 p-2.5",
                    className
                )}
                {...props}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-muted/50">
                            {getWeatherIcon(weather.condition)}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-lg font-bold tracking-tight">
                                    {weather.temperature}
                                </span>
                                <span className="text-xs text-muted-foreground">°C</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                {weather.location}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1">
                            <Droplets className="h-3 w-3 text-blue-500" />
                            <span className="text-[10px] font-medium">{weather.humidity}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Wind className="h-3 w-3 text-emerald-500" />
                            <span className="text-[10px] font-medium">{weather.wind_speed}km/h</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                "bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 p-3 space-y-2.5",
                className
            )}
            {...props}
        >
            <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                    {getWeatherIcon(weather.condition)}
                </div>
                <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold tracking-tight">
                            {weather.temperature}
                        </span>
                        <span className="text-sm text-muted-foreground">°C</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {weather.location}
                    </p>
                </div>
            </div>

            <div className="pt-1 border-t border-border/50" />

            <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-0.5 py-1.5 rounded-md bg-muted/30">
                    <Droplets className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-bold">{weather.humidity}%</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        Humidity
                    </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 py-1.5 rounded-md bg-muted/30">
                    <Wind className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-bold">{weather.wind_speed}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        km/h
                    </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 py-1.5 rounded-md bg-muted/30">
                    <CloudRain className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-bold">{weather.rain_probability}%</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        Rain
                    </span>
                </div>
            </div>
        </div>
    )
}
