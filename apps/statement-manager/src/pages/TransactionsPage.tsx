import { ArrowLeftRight } from 'lucide-react'

export function TransactionsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ArrowLeftRight size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Transactions</h2>
      </div>
      <p className="text-text-muted">Transactions coming soon.</p>
    </div>
  )
}
