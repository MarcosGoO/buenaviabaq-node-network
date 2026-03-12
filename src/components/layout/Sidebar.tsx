"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Car, BarChart3, Settings, ChevronLeft, ChevronRight, Activity, MapPin, Gauge, Brain, ShieldAlert, Clock3, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { WeatherWidget } from "@/components/widgets/WeatherWidget"
import { useTrafficData } from "@/hooks/useTrafficData"
import { useZonesData } from "@/hooks/useZonesData"
import { useDeparturePlan } from "@/hooks/useDeparturePlan"

type SidebarProps = React.HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className, ...props }: SidebarProps) {
    const [collapsed, setCollapsed] = React.useState(false)
    const pathname = usePathname()
    const { summary } = useTrafficData()
    const { zones } = useZonesData()
    const { plan, clearPlan } = useDeparturePlan()

    const avgSpeed = summary?.average_speed != null ? Math.round(summary.average_speed) : '--'
    const activeZones = zones.length > 0 ? zones.length : '--'

    const formatPlanTime = React.useCallback((value: string) => {
        return new Intl.DateTimeFormat("es-CO", {
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(value))
    }, [])

    return (
        <div
            className={cn(
                "relative flex flex-col border-r bg-background shadow-xl z-20",
                "transition-[width] duration-300 ease-in-out will-change-[width]",
                collapsed ? "w-20" : "w-72",
                className
            )}
            {...props}
        >
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b bg-background/95 backdrop-blur-sm">
                <div className={cn(
                    "transition-opacity duration-200",
                    collapsed ? "opacity-0 w-0" : "opacity-100"
                )}>
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                                <Car className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="font-extrabold tracking-tight text-lg text-foreground">
                                BUENA<span className="text-primary">VIA</span>
                            </span>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "h-9 w-9 rounded-lg hover:bg-accent transition-all hover:scale-105",
                        collapsed && "mx-auto"
                    )}
                >
                    {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 flex flex-col gap-6 overflow-y-auto overflow-x-hidden">
                <nav className="flex flex-col gap-2 px-3">
                    <NavItem icon={Gauge} label="Traffic Flow" collapsed={collapsed} active={pathname === '/'} href="/" />
                    <NavItem icon={BarChart3} label="Analytics" collapsed={collapsed} active={pathname === '/analytics'} href="/analytics" />
                    <NavItem icon={Brain} label="Predicciones" collapsed={collapsed} active={pathname === '/predictions'} href="/predictions" />
                    <NavItem icon={ShieldAlert} label="Admin ML" collapsed={collapsed} active={pathname === '/admin'} href="/admin" />
                    <NavItem icon={Settings} label="Settings" collapsed={collapsed} active={pathname === '/settings'} href="/settings" />
                </nav>

                {/* Weather Widget */}
                <div className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 scale-95 h-0" : "opacity-100 scale-100"
                )}>
                    {!collapsed && (
                        <div className="px-3">
                            <div className="flex items-center gap-2 px-1 mb-2">
                                <div className="h-1 w-1 bg-blue-500 rounded-full animate-pulse" />
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                                    Weather
                                </span>
                            </div>
                            <WeatherWidget compact />
                        </div>
                    )}
                </div>

                {/* Stats Section */}
                <div className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 scale-95 h-0" : "opacity-100 scale-100"
                )}>
                    {!collapsed && (
                        <div className="px-3 space-y-3">
                            <div className="flex items-center gap-2 px-1 mb-2">
                                <div className="h-1 w-1 bg-primary rounded-full animate-pulse" />
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                                    Live Metrics
                                </span>
                            </div>
                            <StatCard
                                label="Avg Speed"
                                value={avgSpeed}
                                unit="km/h"
                                icon={Activity}
                            />
                            <StatCard
                                label="Active Zones"
                                value={activeZones}
                                icon={MapPin}
                            />
                        </div>
                    )}
                </div>

                {/* Saved departure plan */}
                <div className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 scale-95 h-0" : "opacity-100 scale-100"
                )}>
                    {!collapsed && plan && (
                        <div className="px-3">
                            <div className="flex items-center gap-2 px-1 mb-2">
                                <div className="h-1 w-1 bg-sky-500 rounded-full animate-pulse" />
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                                    Planned Departure
                                </span>
                            </div>
                            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 text-sky-700">
                                            <Clock3 className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Salida guardada</span>
                                        </div>
                                        <p className="mt-2 text-2xl font-black text-foreground">{formatPlanTime(plan.departureTime)}</p>
                                    </div>
                                    <button
                                        onClick={clearPlan}
                                        className="rounded-full p-1 text-muted-foreground hover:bg-background/70 hover:text-foreground transition-colors"
                                        title="Quitar plan"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-background/80 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Riesgo</p>
                                        <p className="mt-1 text-sm font-bold">{plan.riskScore}/100</p>
                                    </div>
                                    <div className="rounded-xl bg-background/80 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lluvia</p>
                                        <p className="mt-1 text-sm font-bold">{plan.rainProbability}%</p>
                                    </div>
                                </div>
                                <p className="text-xs leading-relaxed text-muted-foreground">{plan.recommendation}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Status */}
            <div className="border-t p-4 bg-muted/20">
                <div className={cn(
                    "transition-all duration-200",
                    collapsed ? "opacity-0 h-0" : "opacity-100"
                )}>
                    {!collapsed && (
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold" suppressHydrationWarning>
                            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                            <span>System Online</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface NavItemProps {
    icon: React.ElementType
    label: string
    collapsed?: boolean
    active?: boolean
    onClick?: () => void
    href?: string
}

function NavItem({ icon: Icon, label, collapsed, active, onClick, href }: NavItemProps) {
    const content = (
        <>
            {/* Active indicator */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}

            <div className={cn(
                "flex items-center gap-3 w-full",
                collapsed ? "justify-center" : "justify-start"
            )}>
                <div className={cn(
                    "flex items-center justify-center rounded-lg transition-all flex-shrink-0",
                    "w-9 h-9",
                    active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground group-hover:text-primary group-hover:bg-primary/5"
                )}>
                    <Icon className="h-5 w-5" />
                </div>

                {!collapsed && (
                    <span className={cn(
                        "font-semibold text-sm transition-colors flex-1",
                        active ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                        {label}
                    </span>
                )}
            </div>
        </>
    );

    const className = cn(
        "relative group rounded-xl transition-all duration-200 flex items-center",
        "hover:scale-[1.02] active:scale-[0.98]",
        collapsed ? "h-12 w-12 mx-auto justify-center" : "h-12 w-full px-3",
        active
            ? "bg-gradient-to-r from-primary/10 to-transparent shadow-sm"
            : "hover:bg-accent/50"
    );

    if (href) {
        return (
            <Link href={href} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className={className}>
            {content}
        </button>
    )
}
