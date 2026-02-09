import { Sidebar } from "@/components/layout/Sidebar"
import { MapViewport } from "@/components/map/MapViewport"

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 fixed inset-0">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <MapViewport />
      </main>
    </div>
  )
}
