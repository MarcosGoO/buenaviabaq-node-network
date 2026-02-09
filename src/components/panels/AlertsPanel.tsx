"use client"

import * as React from "react"
import { AlertTriangle, Calendar, Bell, ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AlertsPanel() {
    const [isOpen, setIsOpen] = React.useState(true)

    return (
        <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col gap-3 transition-all duration-300 ease-in-out">
            {/* Toggle Button when closed */}
            <div
                className={cn(
                    "transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    isOpen ? "opacity-0 scale-90 h-0 w-0 overflow-hidden" : "opacity-100 scale-100 h-10 w-10"
                )}
            >
                <Button
                    size="icon"
                    className="rounded-full shadow-xl bg-background/90 backdrop-blur-md hover:bg-background border-2 border-primary/10 transition-transform active:scale-90"
                    onClick={() => setIsOpen(true)}
                >
                    <Bell className="h-5 w-5 text-primary animate-pulse" />
                </Button>
            </div>

            {/* Expanded Panel */}
            <div
                className={cn(
                    "flex flex-col gap-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top-left",
                    isOpen ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-4 pointer-events-none h-0"
                )}
            >
                <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-70">Traffic intelligence</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-muted/80 transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>

                <Card className="w-80 bg-background/95 backdrop-blur-lg border-l-4 border-l-amber-500 shadow-xl transition-all hover:translate-x-1 hover:shadow-2xl duration-300 border-y-0 border-r-0">
                    <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-xs font-black flex items-center justify-between text-amber-600 tracking-wider uppercase">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Environmental Risk
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                        <p className="text-sm font-bold text-foreground leading-tight">
                            Carrera 43: Moderate Arroyo Risk
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                            Current rain probability is <span className="font-bold text-amber-700">60%</span>. Extreme caution advised.
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-80 bg-background/95 backdrop-blur-lg border-l-4 border-l-indigo-600 shadow-xl transition-all hover:translate-x-1 hover:shadow-2xl duration-300 delay-75 border-y-0 border-r-0">
                    <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-xs font-black flex items-center gap-2 text-indigo-600 tracking-wider uppercase">
                            <Calendar className="h-4 w-4" />
                            Event Intelligence
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                        <p className="text-sm font-bold text-foreground leading-tight">
                            Metropolitano: Junior vs. Millonarios (18:00)
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                            Severe congestion expected on <span className="font-bold text-indigo-700">Circunvalar & Calle 30</span>.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
