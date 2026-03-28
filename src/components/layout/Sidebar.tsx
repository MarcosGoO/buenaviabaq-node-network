"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BarChart3,
  Bookmark,
  Brain,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  MapPin,
  Settings,
  ShieldAlert,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { WeatherWidget } from "@/components/widgets/WeatherWidget"
import { useTrafficData } from "@/hooks/useTrafficData"
import { useZonesData } from "@/hooks/useZonesData"
import { useDeparturePlan } from "@/hooks/useDeparturePlan"
import { useFavoriteRoutePlan } from "@/hooks/useFavoriteRoutePlan"

type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  allowCollapse?: boolean
  onNavigate?: () => void
}

export const APP_NAV_ITEMS = [
  { href: "/", label: "Traffic Flow", mobileLabel: "Mapa", icon: Gauge },
  { href: "/analytics", label: "Analytics", mobileLabel: "Datos", icon: BarChart3 },
  { href: "/predictions", label: "Predicciones", mobileLabel: "ML", icon: Brain },
  { href: "/admin", label: "Admin ML", mobileLabel: "Admin", icon: ShieldAlert },
  { href: "/settings", label: "Settings", mobileLabel: "Ajustes", icon: Settings },
] as const

export function Sidebar({ className, allowCollapse = true, onNavigate, ...props }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const pathname = usePathname()
  const { summary } = useTrafficData()
  const { zones } = useZonesData()
  const { plan, clearPlan } = useDeparturePlan()
  const { plan: favoriteRoutePlan, clearPlan: clearFavoriteRoutePlan } = useFavoriteRoutePlan()

  const isCollapsed = allowCollapse && collapsed
  const avgSpeed = summary?.average_speed != null ? Math.round(summary.average_speed) : "--"
  const activeZones = zones.length > 0 ? zones.length : "--"

  const formatPlanTime = React.useCallback((value: string) => {
    return new Intl.DateTimeFormat("es-CO", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  }, [])

  return (
    <aside
      className={cn(
        "relative z-20 flex h-full flex-col border-r bg-background",
        "transition-[width] duration-300 ease-in-out will-change-[width]",
        allowCollapse ? (collapsed ? "w-20" : "w-72") : "w-full",
        className
      )}
      {...props}
    >
      <div className="flex h-16 items-center justify-between border-b bg-background/95 px-4">
        <div className={cn("transition-opacity duration-200", isCollapsed ? "w-0 opacity-0" : "opacity-100")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Car className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                BUENA<span className="text-primary">VIA</span>
              </span>
            </div>
          )}
        </div>

        {allowCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "focus-ring interactive-soft h-9 w-9 rounded-lg hover:bg-muted/60",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="minimal-scrollbar flex flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto py-6">
        <nav className="flex flex-col gap-2 px-3">
          {APP_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={isCollapsed}
              active={pathname === item.href}
              href={item.href}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <Section collapsed={isCollapsed}>
          <div className="px-3">
            <SectionLabel color="bg-blue-500" label="Weather" />
            <WeatherWidget compact />
          </div>
        </Section>

        <Section collapsed={isCollapsed}>
          <div className="space-y-3 px-3">
            <SectionLabel color="bg-primary" label="Live Metrics" />
            <StatCard label="Avg Speed" value={avgSpeed} unit="km/h" icon={Activity} />
            <StatCard label="Active Zones" value={activeZones} icon={MapPin} />
          </div>
        </Section>

        <Section collapsed={isCollapsed}>
          {plan && (
            <div className="px-3">
              <SectionLabel color="bg-sky-500" label="Planned Departure" />
              <div className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.12em]">Salida guardada</span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatPlanTime(plan.departureTime)}</p>
                  </div>
                  <button
                    onClick={clearPlan}
                    className="focus-ring interactive-soft rounded-full p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    title="Quitar plan"
                    aria-label="Quitar plan"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Riesgo</p>
                    <p className="mt-1 text-sm font-semibold">{plan.riskScore}/100</p>
                  </div>
                  <div className="rounded-xl bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Lluvia</p>
                    <p className="mt-1 text-sm font-semibold">{plan.rainProbability}%</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{plan.recommendation}</p>
              </div>
            </div>
          )}
        </Section>

        <Section collapsed={isCollapsed}>
          {favoriteRoutePlan && (
            <div className="px-3">
              <SectionLabel color="bg-violet-500" label="Favorite Trip" />
              <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                    <Bookmark className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]">Trayecto guardado</span>
                  </div>
                  <button
                    onClick={clearFavoriteRoutePlan}
                    className="focus-ring interactive-soft rounded-full p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    title="Quitar trayecto"
                    aria-label="Quitar trayecto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="rounded-xl bg-background/80 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">{favoriteRoutePlan.originLabel}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">hacia</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{favoriteRoutePlan.destinationLabel}</p>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="border-t bg-muted/20 p-4">
        <div className={cn("transition-all duration-200", isCollapsed ? "h-0 opacity-0" : "opacity-100")}>
          {!isCollapsed && (
            <div
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80"
              suppressHydrationWarning
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>System Online</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function Section({
  collapsed,
  children,
}: {
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "transition-all duration-300",
        collapsed ? "h-0 scale-95 opacity-0" : "scale-100 opacity-100"
      )}
    >
      {!collapsed && children}
    </div>
  )
}

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
        {label}
      </span>
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
  onNavigate?: () => void
}

function NavItem({ icon: Icon, label, collapsed, active, onClick, href, onNavigate }: NavItemProps) {
  const content = (
    <>
      {active && <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}

      <div className={cn("flex w-full items-center gap-3", collapsed ? "justify-center" : "justify-start")}>
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {!collapsed && (
          <span
            className={cn(
              "flex-1 text-sm font-semibold transition-colors",
              active ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
            )}
          >
            {label}
          </span>
        )}
      </div>
    </>
  )

  const className = cn(
    "interactive-soft relative group flex items-center rounded-xl duration-200",
    collapsed ? "mx-auto h-12 w-12 justify-center" : "h-12 w-full px-3",
    active ? "bg-primary/10" : "hover:bg-muted/60"
  )

  if (href) {
    return (
      <Link href={href} className={className} onClick={onNavigate}>
        {content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  )
}
