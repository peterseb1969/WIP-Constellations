import { LayoutDashboard } from 'lucide-react'

export function DashboardPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Dashboard</h2>
      </div>
      <p className="text-text-muted">Dashboard coming soon.</p>
    </div>
  )
}
