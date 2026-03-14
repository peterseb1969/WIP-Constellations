import { Upload } from 'lucide-react'

export function ImportPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Import</h2>
      </div>
      <p className="text-text-muted">Import coming soon.</p>
    </div>
  )
}
