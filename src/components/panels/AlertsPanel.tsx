"use client"

import * as React from "react"
import { AlertTriangle, Calendar, Bell, X, ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AlertsPanel() {
    const [isOpen, setIsOpen] = React.useState(true)

    return (
        <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col gap-2 transition-all duration-300 ease-in-out">
            {/* Toggle Button when closed */}
            <div
                className={cn(
                    "transform transition-all duration-500 ease-spring",
                    isOpen ? "opacity-0 scale-90 h-0 w-0 overflow-hidden" : "opacity-100 scale-100 h-10 w-10"
                )}
            >
                <Button
                    size="icon"
                    className="rounded-full shadow-lg bg-background/80 backdrop-blur hover:bg-background border"
                    onClick={() => setIsOpen(true)}
                >
                    <Bell className="h-5 w-5 text-primary" />
                </Button>
            </div>

            {/* Expanded Panel */}
            <div
                className={cn(
                    "flex flex-col gap-2 transition-all duration-500 ease-spring origin-top-left",
                    isOpen ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-4 pointer-events-none h-0 opacity-0"
                )}
            >
                <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground/80 tracking-wide uppercase">Notifications</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-muted/80"
                        onClick={() => setIsOpen(false)}
                    >
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>

                <Card className="w-80 bg-background/95 backdrop-blur border-l-4 border-l-yellow-500 shadow-md transition-all hover:translate-x-1 duration-300">
                    <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between text-yellow-600">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Arroyo Alert Risk
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-2">
                        <p className="text-sm font-medium text-foreground/90 leading-snug">
                            Moderate risk in Carrera 43.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Rain probability: <span className="font-semibold text-foreground/80">60%</span>
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-80 bg-background/95 backdrop-blur border-l-4 border-l-blue-500 shadow-md transition-all hover:translate-x-1 duration-300 delay-75">
                    <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                            <Calendar className="h-4 w-4" />
                            Event Impact
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-2">
                        <p className="text-sm font-medium text-foreground/90 leading-snug">
                            Metropolitano Stadium: Junior vs. Millonarios (18:00).
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            High congestion expected on Circunvalar.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
