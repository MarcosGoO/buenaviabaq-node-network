"use client"

import dynamic from "next/dynamic"
import { AppShell } from "@/components/layout/AppShell"

const MapViewport = dynamic(() => import("@/components/map/MapViewport").then((m) => m.MapViewport), { ssr: false })
const RealTimeUpdates = dynamic(() => import("@/components/dashboard/RealTimeUpdates"), { ssr: false })

export default function Home() {
  return (
    <AppShell mainClassName="overflow-hidden">
      <div className="relative h-[calc(100dvh-7.5rem)] overflow-hidden md:h-full">
        <MapViewport />
        <RealTimeUpdates />
      </div>
    </AppShell>
  )
}
