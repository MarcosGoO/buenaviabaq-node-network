import { AppShell } from "@/components/layout/AppShell"
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function AnalyticsPage() {
  return (
    <AppShell mainClassName="overflow-y-auto">
      <div className="relative">
        <AnalyticsDashboard />
        <RealTimeUpdates />
      </div>
    </AppShell>
  )
}
