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
    const [hour, setHour] = React.useState(12) // Start at 12:00 PM

    const handleSliderChange = (value: number[]) => {
        setHour(value[0])
        onTimeChange?.(value[0])
    }

    const togglePlay = () => {
        setIsPlaying(!isPlaying)
    }

    // Formatting hour (e.g., 14 -> 2:00 PM)
    const formatHour = (h: number) => {
        const period = h >= 12 ? "PM" : "AM"
        const displayH = h % 12 || 12
        return `${displayH}:00 ${period}`
    }

    const getTimeOfDay = (h: number) => {
        if (h >= 5 && h < 12) return "Morning"
        if (h >= 12 && h < 17) return "Afternoon"
        if (h >= 17 && h < 21) return "Evening"
        return "Night"
    }

    return (
        <div
            className={cn(
                "bg-background/90 backdrop-blur-xl p-5 rounded-2xl border border-border/50 shadow-2xl w-full max-w-md",
                "transition-all duration-300 hover:shadow-3xl hover:border-primary/20",
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Time Simulation
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium ml-7">
                        {getTimeOfDay(hour)} Traffic
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                        {formatHour(hour)}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-medium tracking-wider mt-0.5 flex items-center justify-end gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        Today
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant={isPlaying ? "default" : "outline"}
                    size="icon"
                    onClick={togglePlay}
                    className="h-9 w-9 rounded-full shrink-0 shadow-md transition-all hover:scale-105 active:scale-95"
                >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <div className="flex-1 space-y-2">
                    <Slider
                        defaultValue={[12]}
                        max={23}
                        step={1}
                        value={[hour]}
                        onValueChange={handleSliderChange}
                        className="flex-1"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground/50 font-medium px-0.5" suppressHydrationWarning>
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
