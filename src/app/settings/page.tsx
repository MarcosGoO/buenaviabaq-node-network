import { AppShell } from "@/components/layout/AppShell"
import SettingsDashboard from "@/components/dashboard/SettingsDashboard"

export default function SettingsPage() {
  return (
    <AppShell mainClassName="overflow-y-auto">
      <div className="relative">
        <SettingsDashboard />
      </div>
    </AppShell>
  )
}
