"use client"

import * as React from "react"
import { Car, BarChart3, Settings, ChevronLeft, ChevronRight, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
            <div className="flex h-14 items-center justify-between border-b px-3 py-4">
                {!collapsed && (
                    <span className="font-bold tracking-tight text-lg truncate">BUENAVIA-BAQ</span>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn("bg-transparent", collapsed && "mx-auto")}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            <div className="flex-1 py-4">
                <nav className="grid gap-1 px-2">
                    <NavItem icon={Car} label="Traffic Flow" collapsed={collapsed} active />
                    <NavItem icon={BarChart3} label="Analytics" collapsed={collapsed} />
                    <NavItem icon={Settings} label="Settings" collapsed={collapsed} />
                </nav>
            </div>

            <div className="border-t p-3">
                {!collapsed && (
                    <div className="text-xs text-muted-foreground p-2">
                        System Status: <span className="text-green-500 font-medium">Online</span>
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
                "justify-start transition-all",
                collapsed ? "justify-center px-2" : "px-4",
                active && "font-semibold"
            )}
            onClick={onClick}
        >
            <Icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
            {!collapsed && <span>{label}</span>}
            {collapsed && <span className="sr-only">{label}</span>}
        </Button>
    )
}
