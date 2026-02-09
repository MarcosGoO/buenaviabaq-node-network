"use client"

import * as React from "react"
import { AlertTriangle, Calendar, Bell, ChevronLeft, Droplets } from "lucide-react"
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
                    isOpen ? "opacity-0 scale-90 h-0 w-0 overflow-hidden" : "opacity-100 scale-100 h-11 w-11"
                )}
            >
                <Button
                    size="icon"
                    className="h-11 w-11 rounded-full shadow-2xl bg-background/90 backdrop-blur-md hover:bg-background border-2 border-primary/20 transition-all hover:scale-110 active:scale-95"
                    onClick={() => setIsOpen(true)}
                >
                    <div className="relative">
                        <Bell className="h-5 w-5 text-primary" />
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                    </div>
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
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-primary rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-70">
                            Live Intelligence
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-muted/80 transition-all hover:rotate-180"
                        onClick={() => setIsOpen(false)}
                    >
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>

                <Card className="w-80 bg-background/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl transition-all hover:translate-x-1 hover:shadow-amber-500/20 duration-300 overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="p-4 pb-2 relative">
                        <CardTitle className="text-xs font-black flex items-center justify-between tracking-wider uppercase">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-amber-500/10">
                                    <Droplets className="h-3.5 w-3.5 text-amber-600" />
                                </div>
                                <span className="text-amber-600">Arroyo Warning</span>
                            </div>
                            <span className="text-[9px] text-amber-600/60 font-medium">MEDIUM</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 relative">
                        <p className="text-sm font-bold text-foreground leading-tight mb-2">
                            Carrera 43 - Moderate Risk
                        </p>
                        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                            Rain probability <span className="font-bold text-amber-600">60%</span> in next 2h. Monitor conditions closely.
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-80 bg-background/95 backdrop-blur-xl border border-indigo-500/30 shadow-2xl transition-all hover:translate-x-1 hover:shadow-indigo-500/20 duration-300 overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="p-4 pb-2 relative">
                        <CardTitle className="text-xs font-black flex items-center justify-between tracking-wider uppercase">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-500/10">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                                </div>
                                <span className="text-indigo-600">Event Impact</span>
                            </div>
                            <span className="text-[9px] text-indigo-600/60 font-medium">18:00</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 relative">
                        <p className="text-sm font-bold text-foreground leading-tight mb-2">
                            Junior vs. Millonarios
                        </p>
                        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                            Heavy congestion on <span className="font-bold text-indigo-600">Circunvalar</span> and <span className="font-bold text-indigo-600">Calle 30</span>.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
