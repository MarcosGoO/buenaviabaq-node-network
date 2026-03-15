import { Sidebar } from "@/components/layout/Sidebar"
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function AnalyticsPage() {
  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <AnalyticsDashboard />
        <RealTimeUpdates />
      </main>
    </div>
  )
}

