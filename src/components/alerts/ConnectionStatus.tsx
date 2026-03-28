"use client"

import { useSyncExternalStore } from "react"
import { WifiOff } from "lucide-react"
import { useSocketIO } from "@/hooks/useSocketIO"

interface ConnectionStatusProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}

export function ConnectionStatus({
  position = "bottom-left",
}: ConnectionStatusProps) {
  const { isConnected } = useSocketIO()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted || isConnected) {
    return null
  }

  const getPositionStyles = () => {
    switch (position) {
      case "top-left":
        return "top-4 left-4"
      case "top-right":
        return "top-4 right-4"
      case "bottom-left":
        return "bottom-4 left-4"
      case "bottom-right":
        return "bottom-4 right-4"
      default:
        return "bottom-4 left-4"
    }
  }

  return (
    <div
      className={`fixed ${getPositionStyles()} z-[9998] transition-all duration-300`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-destructive/10 px-4 py-2 text-red-700 shadow-sm dark:text-red-300">
        <WifiOff className="h-4 w-4 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium">Reconectando...</span>
        </div>
      </div>
    </div>
  )
}
