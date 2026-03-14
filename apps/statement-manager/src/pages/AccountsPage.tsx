import { useState } from 'react'
import { Landmark, Plus, CreditCard, Wallet, Building2, TrendingUp, ChevronRight } from 'lucide-react'
import { useDocuments } from '@wip/react'
import type { Document } from '@wip/client'
import { cn, maskIban } from '@/lib/utils'

const ACCOUNT_TYPE_ICONS: Record<string, typeof Landmark> = {
  CHECKING: Wallet,
  SAVINGS: Landmark,
  CREDIT_CARD: CreditCard,
  SHARE_DEPOT: TrendingUp,
  EMPLOYER: Building2,
}

function AccountCard({ doc }: { doc: Document }) {
  const data = doc.data as Record<string, string>
  const Icon = ACCOUNT_TYPE_ICONS[data.account_type] ?? Landmark

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
          <Icon size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{data.institution}</h3>
          <p className="text-sm text-text-muted mt-0.5">
            {data.description || data.account_type?.replace('_', ' ')}
          </p>
          <p className="text-sm text-text-muted mt-1 font-mono">
            {maskIban(data.iban)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-text-muted rounded">
            {data.primary_currency}
          </span>
        </div>
      </div>
      {data.holder_name && (
        <p className="text-xs text-text-muted mt-3 pt-3 border-t border-gray-100">
          {data.holder_name}
        </p>
      )}
      <div className="flex items-center justify-end mt-2 text-primary text-sm">
        <span>View transactions</span>
        <ChevronRight size={16} />
      </div>
    </div>
  )
}

export function AccountsPage() {
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading, error } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
  })

  const accounts = data?.items ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Landmark size={24} className="text-primary" />
          <h2 className="text-2xl font-semibold">Accounts</h2>
          {!isLoading && (
            <span className="text-sm text-text-muted">({accounts.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'bg-primary text-white hover:bg-primary/90',
          )}
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 rounded-lg p-4">
          <p className="font-medium">Failed to load accounts</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Landmark size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No accounts yet</p>
          <p className="text-sm mt-1">Add your first account to get started.</p>
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((doc) => (
            <AccountCard key={doc.document_id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
