import { Sidebar } from "@/components/layout/Sidebar"
import SettingsDashboard from "@/components/dashboard/SettingsDashboard"

export default function SettingsPage() {
  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <SettingsDashboard />
      </main>
    </div>
  )
}


