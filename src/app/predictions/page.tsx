import { Sidebar } from "@/components/layout/Sidebar"
import PredictionsDashboard from "@/components/dashboard/PredictionsDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function PredictionsPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 fixed inset-0">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <PredictionsDashboard />
        <RealTimeUpdates />
      </main>
    </div>
  )
}
