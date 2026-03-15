"use client"

import * as React from "react"
import { Play, Pause, Clock, Calendar } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TimeTravelerProps extends React.HTMLAttributes<HTMLDivElement> {
    onTimeChange?: (hour: number) => void
}

export function TimeTraveler({ className, onTimeChange, ...props }: TimeTravelerProps) {
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [hour, setHour] = React.useState(12)
    const hourRef = React.useRef(12)

    React.useEffect(() => {
        const currentHour = new Date().getHours()
        hourRef.current = currentHour
        setHour(currentHour)
    }, [])

    // Auto-advance hour when playing
    React.useEffect(() => {
        if (!isPlaying) return
        const timer = setInterval(() => {
            const next = (hourRef.current + 1) % 24
            hourRef.current = next
            setHour(next)
            onTimeChange?.(next)
        }, 1500)
        return () => clearInterval(timer)
    }, [isPlaying, onTimeChange])

    const handleSliderChange = (value: number[]) => {
        setIsPlaying(false)
        const selectedHour = value[0]
        hourRef.current = selectedHour
        setHour(selectedHour)
        onTimeChange?.(selectedHour)
    }

    const togglePlay = () => {
        setIsPlaying(prev => !prev)
    }

    // Formatting hour (e.g., 14 -> 2:00 PM)
    const formatHour = (h: number) => {
        const period = h >= 12 ? "PM" : "AM"
        const displayH = h % 12 || 12
        return `${displayH}:00 ${period}`
    }

    const getTimeOfDay = (h: number) => {
        if (h >= 5 && h < 12) return "Manana"
        if (h >= 12 && h < 17) return "Tarde"
        if (h >= 17 && h < 21) return "Noche"
        return "Madrugada"
    }

    return (
        <div
            className={cn(
                "overlay-surface p-5 rounded-2xl w-full max-w-md",
                "interactive-soft fade-enter hover:border-primary/30",
                className
            )}
            {...props}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                            Simulacion de tiempo
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium ml-7">
                        Trafico en la {getTimeOfDay(hour).toLowerCase()}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                        {formatHour(hour)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium tracking-wide text-muted-foreground/70">
                        <Calendar className="w-2.5 h-2.5" />
                        Hoy
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant={isPlaying ? "default" : "outline"}
                    size="icon"
                    onClick={togglePlay}
                    className="focus-ring interactive-soft surface-lift h-9 w-9 rounded-full shrink-0 hover:bg-muted/60"
                    title={isPlaying ? "Pausar simulacion" : "Iniciar simulacion"}
                    aria-label={isPlaying ? "Pausar simulacion" : "Iniciar simulacion"}
                    aria-pressed={isPlaying}
                >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <div className="flex-1 space-y-2 rounded-lg px-1 py-1 hover:bg-muted/20">
                    <Slider
                        max={23}
                        step={1}
                        value={[hour]}
                        onValueChange={handleSliderChange}
                        className="flex-1"
                        aria-label="Hora simulada"
                    />
                    <div className="flex justify-between px-0.5 text-[10px] font-medium text-muted-foreground/70" suppressHydrationWarning>
                        <span>12 AM</span>
                        <span>6 AM</span>
                        <span>12 PM</span>
                        <span>6 PM</span>
                        <span>11 PM</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
