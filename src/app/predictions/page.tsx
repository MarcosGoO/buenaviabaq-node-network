import { AppShell } from "@/components/layout/AppShell"
import PredictionsDashboard from "@/components/dashboard/PredictionsDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function PredictionsPage() {
  return (
    <AppShell mainClassName="overflow-y-auto">
      <div className="relative">
        <PredictionsDashboard />
        <RealTimeUpdates />
      </div>
    </AppShell>
  )
}
