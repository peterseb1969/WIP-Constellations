import { FileText } from 'lucide-react'

export function PayslipsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Payslips</h2>
      </div>
      <p className="text-text-muted">Payslips coming soon.</p>
    </div>
  )
}
