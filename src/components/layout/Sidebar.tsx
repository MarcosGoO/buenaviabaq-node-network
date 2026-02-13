"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Car, BarChart3, Settings, ChevronLeft, ChevronRight, Activity, MapPin, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className, ...props }: SidebarProps) {
    const [collapsed, setCollapsed] = React.useState(false)
    const pathname = usePathname()

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
                    <NavItem icon={TrendingUp} label="Traffic Flow" collapsed={collapsed} active={pathname === '/'} href="/" />
                    <NavItem icon={BarChart3} label="Analytics" collapsed={collapsed} active={pathname === '/analytics'} href="/analytics" />
                    <NavItem icon={Settings} label="Settings" collapsed={collapsed} />
                </nav>

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
                "flex items-center gap-3",
                collapsed ? "justify-center" : "justify-start pl-3"
            )}>
                <div className={cn(
                    "flex items-center justify-center rounded-lg transition-all",
                    "w-8 h-8",
                    active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground group-hover:text-primary group-hover:bg-primary/5"
                )}>
                    <Icon className="h-4 w-4" />
                </div>

                {!collapsed && (
                    <span className={cn(
                        "font-semibold text-sm transition-colors",
                        active ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                        {label}
                    </span>
                )}
            </div>
        </>
    );

    const className = cn(
        "relative group rounded-xl transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        collapsed ? "h-12 w-12 mx-auto" : "h-12 w-full px-4",
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
