import { AppShell } from "@/components/layout/AppShell"
import AdminDashboard from "@/components/dashboard/AdminDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function AdminPage() {
  return (
    <AppShell mainClassName="overflow-y-auto">
      <div className="relative">
        <AdminDashboard />
        <RealTimeUpdates />
      </div>
    </AppShell>
  )
}
