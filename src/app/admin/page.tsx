import { Sidebar } from "@/components/layout/Sidebar"
import AdminDashboard from "@/components/dashboard/AdminDashboard"
import RealTimeUpdates from "@/components/dashboard/RealTimeUpdates"

export default function AdminPage() {
  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <AdminDashboard />
        <RealTimeUpdates />
      </main>
    </div>
  )
}


