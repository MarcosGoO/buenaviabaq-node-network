"use client"

import * as React from "react"
import { Car, BarChart3, Settings, ChevronLeft, ChevronRight, Activity, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className, ...props }: SidebarProps) {
    const [collapsed, setCollapsed] = React.useState(false)

    return (
        <div
            className={cn(
                "relative flex flex-col border-r bg-background transition-all duration-300 ease-in-out",
                collapsed ? "w-16" : "w-64",
                className
            )}
            {...props}
        >
            <div className="flex h-14 items-center justify-between border-b px-4 py-4">
                {!collapsed && (
                    <span className="font-extrabold tracking-tight text-xl text-primary drop-shadow-sm">
                        BUENAVIA<span className="text-muted-foreground/60">-</span>BAQ
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn("hover:bg-accent/50", collapsed && "mx-auto")}
                >
                    {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>

            <div className="flex-1 py-6 flex flex-col gap-6 overflow-y-auto">
                <nav className="grid gap-2 px-3">
                    <NavItem icon={Car} label="Traffic Flow" collapsed={collapsed} active />
                    <NavItem icon={BarChart3} label="Analytics" collapsed={collapsed} />
                    <NavItem icon={Settings} label="Settings" collapsed={collapsed} />
                </nav>

                {!collapsed && (
                    <div className="px-3 space-y-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold px-1">
                            Live Metrics
                        </div>
                        <StatCard
                            label="Avg Speed"
                            value={42}
                            unit="km/h"
                            icon={Activity}
                            trend={{ value: 8, isPositive: true }}
                        />
                        <StatCard
                            label="Active Zones"
                            value={12}
                            icon={MapPin}
                        />
                    </div>
                )}
            </div>

            <div className="border-t p-4 bg-muted/30">
                {!collapsed && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold p-1" suppressHydrationWarning>
                        System Status: <span className="text-emerald-600 ml-1">Live</span>
                        <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full ml-1.5 animate-pulse" />
                    </div>
                )}
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
}

function NavItem({ icon: Icon, label, collapsed, active, onClick }: NavItemProps) {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            className={cn(
                "justify-start transition-all duration-200 group relative",
                collapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-4 h-11 w-full",
                active && "bg-secondary/80 font-bold text-primary shadow-sm border-r-2 border-primary"
            )}
            onClick={onClick}
        >
            <Icon className={cn("h-5 w-5 shrink-0", !collapsed && "mr-3", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-primary")} />
            {!collapsed && <span className="text-sm font-semibold tracking-tight uppercase truncate">{label}</span>}
            {collapsed && <span className="sr-only">{label}</span>}
        </Button>
    )
}
