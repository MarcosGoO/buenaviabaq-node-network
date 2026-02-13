import { Sidebar } from "@/components/layout/Sidebar"
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function AnalyticsPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 fixed inset-0">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <AnalyticsDashboard />
        <RealTimeUpdates />
      </main>
    </div>
  )
}