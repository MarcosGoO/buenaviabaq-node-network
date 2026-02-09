"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  unit?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  unit,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-background/60 backdrop-blur-sm p-4 transition-all hover:bg-background/80 hover:shadow-lg",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {unit && (
              <span className="text-sm text-muted-foreground font-medium">
                {unit}
              </span>
            )}
          </div>
          {trend && (
            <p
              className={cn(
                "text-xs font-semibold",
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-full bg-primary/10 p-2 transition-transform group-hover:scale-110">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
    </div>
  )
}
