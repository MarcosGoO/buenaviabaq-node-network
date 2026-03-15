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
    const configuredApiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    const apiBase = configuredApiBase.replace(/\/$/, "")
    const weatherUrl = apiBase.endsWith("/api/v1") ? `${apiBase}/weather/current` : `${apiBase}/api/v1/weather/current`

    async function fetchWeather() {
      try {
        const response = await fetch(weatherUrl)

        if (!response.ok) {
          const errorBody = await response.text()
          console.warn("Weather endpoint returned non-OK status", {
            status: response.status,
            body: errorBody.slice(0, 120),
          })
          return
        }

        const contentType = response.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) {
          const rawBody = await response.text()
          console.warn("Weather endpoint returned non-JSON payload", {
            contentType,
            body: rawBody.slice(0, 120),
          })
          return
        }

        const data = await response.json()
        setWeather(data.data)
      } catch (error) {
        console.warn("Weather fetch error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const getWeatherIcon = (condition: string) => {
    const cond = condition?.toLowerCase() || ""

    if (cond.includes("clear") || cond.includes("sun")) {
      return <Sun className="h-4 w-4 text-amber-500" />
    }
    if (cond.includes("rain")) {
      return <CloudRain className="h-4 w-4 text-blue-500" />
    }
    if (cond.includes("drizzle")) {
      return <CloudDrizzle className="h-4 w-4 text-blue-400" />
    }
    if (cond.includes("fog") || cond.includes("mist")) {
      return <CloudFog className="h-4 w-4 text-slate-400" />
    }
    return <Cloud className="h-4 w-4 text-slate-400" />
  }

  if (loading) {
    return (
      <div className={cn("animate-pulse rounded-lg border bg-card p-3", className)} {...props}>
        <div className="h-14 rounded bg-muted" />
      </div>
    )
  }

  if (!weather) return null

  if (compact) {
    return (
      <div className={cn("rounded-lg border bg-card px-3 py-2.5", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-1.5">{getWeatherIcon(weather.condition)}</div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-semibold tracking-tight">{weather.temperature}</span>
                <span className="text-xs text-muted-foreground">°C</span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{weather.location}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1 text-[11px]">
              <Droplets className="h-3 w-3 text-blue-500" />
              <span className="font-medium">{weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <Wind className="h-3 w-3 text-emerald-500" />
              <span className="font-medium">{weather.wind_speed} km/h</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-3", className)} {...props}>
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-muted p-2">{getWeatherIcon(weather.condition)}</div>
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight">{weather.temperature}</span>
            <span className="text-sm text-muted-foreground">°C</span>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{weather.location}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border bg-muted/30 py-1.5 text-center">
          <Droplets className="mx-auto h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-semibold">{weather.humidity}%</span>
          <p className="text-[10px] uppercase text-muted-foreground">Humidity</p>
        </div>
        <div className="rounded-md border bg-muted/30 py-1.5 text-center">
          <Wind className="mx-auto h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold">{weather.wind_speed}</span>
          <p className="text-[10px] uppercase text-muted-foreground">km/h</p>
        </div>
        <div className="rounded-md border bg-muted/30 py-1.5 text-center">
          <CloudRain className="mx-auto h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold">{weather.rain_probability}%</span>
          <p className="text-[10px] uppercase text-muted-foreground">Rain</p>
        </div>
      </div>
    </div>
  )
}

