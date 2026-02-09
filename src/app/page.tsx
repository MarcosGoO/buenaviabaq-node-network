import { Sidebar } from "@/components/layout/Sidebar"
import { MapViewport } from "@/components/map/MapViewport"

export default function Home() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 relative">
        <MapViewport />
      </main>
    </div>
  )
}
