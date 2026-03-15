"use client";

import { AlertsPanel } from "@/components/panels/AlertsPanel";

// Legacy component kept for compatibility.
// Notification rendering is centralized in AlertsPanel.
export function AlertNotifications() {
  return <AlertsPanel />;
}

