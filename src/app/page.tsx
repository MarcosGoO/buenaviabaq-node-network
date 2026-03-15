"use client"

import dynamic from "next/dynamic"

const Sidebar = dynamic(() => import("@/components/layout/Sidebar").then((m) => m.Sidebar), { ssr: false })
const MapViewport = dynamic(() => import("@/components/map/MapViewport").then((m) => m.MapViewport), { ssr: false })
const RealTimeUpdates = dynamic(() => import("@/components/dashboard/RealTimeUpdates"), { ssr: false })

export default function Home() {
  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <MapViewport />
        <RealTimeUpdates />
      </main>
    </div>
  )
}

