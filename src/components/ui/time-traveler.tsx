"use client"

import * as React from "react"
import { Play, Pause, Clock } from "lucide-react"
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

    return (
        <div className={cn("bg-background/80 backdrop-blur-md p-4 rounded-xl border shadow-lg flex flex-col gap-4 w-full max-w-md", className)} {...props}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Traffic Prediction</span>
                </div>
                <span className="text-lg font-bold font-mono text-primary">{formatHour(hour)}</span>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={togglePlay} className="h-8 w-8 rounded-full shrink-0">
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <Slider
                    defaultValue={[12]}
                    max={23}
                    step={1}
                    value={[hour]}
                    onValueChange={handleSliderChange}
                    className="flex-1"
                />
            </div>
        </div>
    )
}
