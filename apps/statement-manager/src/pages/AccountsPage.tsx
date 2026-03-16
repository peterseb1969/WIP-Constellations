import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Plus, X, CreditCard, Wallet, Building2, TrendingUp, ChevronRight } from 'lucide-react'
import { useDocuments, useCreateDocument, useTemplateByValue } from '@wip/react'
import type { Document } from '@wip/client'
import { cn, maskIban } from '@/lib/utils'
import { TermSelect } from '@/components/TermSelect'

const ACCOUNT_TYPE_ICONS: Record<string, typeof Landmark> = {
  CHECKING: Wallet,
  SAVINGS: Landmark,
  CREDIT_CARD: CreditCard,
  SHARE_DEPOT: TrendingUp,
  EMPLOYER: Building2,
}

function AccountCard({ doc }: { doc: Document }) {
  const navigate = useNavigate()
  const data = doc.data as Record<string, string>
  const Icon = ACCOUNT_TYPE_ICONS[data.account_type] ?? Landmark

  function handleViewTransactions() {
    navigate(`/transactions?account=${doc.document_id}`)
  }

  return (
    <div
      onClick={handleViewTransactions}
      className="bg-surface border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer">
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

interface AccountFormData {
  iban: string
  institution: string
  account_type: string
  primary_currency: string
  holder_name: string
  account_number: string
  swift_bic: string
  description: string
}

const emptyForm: AccountFormData = {
  iban: '',
  institution: '',
  account_type: '',
  primary_currency: 'CHF',
  holder_name: '',
  account_number: '',
  swift_bic: '',
  description: '',
}

function AccountForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<AccountFormData>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const { data: templateData } = useTemplateByValue('FIN_ACCOUNT')
  const templateId = templateData?.template_id

  const createDocument = useCreateDocument({
    onSuccess: () => {
      onClose()
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!templateId) {
      setError('Template not loaded yet. Please try again.')
      return
    }

    const data: Record<string, unknown> = {
      iban: form.iban.trim(),
      institution: form.institution.trim(),
      account_type: form.account_type,
      primary_currency: form.primary_currency,
    }
    if (form.holder_name.trim()) data.holder_name = form.holder_name.trim()
    if (form.account_number.trim()) data.account_number = form.account_number.trim()
    if (form.swift_bic.trim()) data.swift_bic = form.swift_bic.trim()
    if (form.description.trim()) data.description = form.description.trim()

    createDocument.mutate({ template_id: templateId, template_version: templateData?.version, data })
  }

  function updateField(field: keyof AccountFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">New Account</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Required fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              IBAN <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.iban}
              onChange={(e) => updateField('iban', e.target.value)}
              required
              minLength={5}
              maxLength={34}
              placeholder="CH93 0076 2011 6238 5295 7"
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Institution <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => updateField('institution', e.target.value)}
              required
              placeholder="UBS, PostFinance, etc."
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Account Type <span className="text-danger">*</span>
            </label>
            <TermSelect
              terminologyValue="FIN_ACCOUNT_TYPE"
              value={form.account_type}
              onChange={(v) => updateField('account_type', v)}
              placeholder="Select account type..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Currency <span className="text-danger">*</span>
            </label>
            <TermSelect
              terminologyValue="FIN_CURRENCY"
              value={form.primary_currency}
              onChange={(v) => updateField('primary_currency', v)}
              placeholder="Select currency..."
              required
            />
          </div>
        </div>

        {/* Optional fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Account Holder</label>
            <input
              type="text"
              value={form.holder_name}
              onChange={(e) => updateField('holder_name', e.target.value)}
              placeholder="Name on the account"
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Number</label>
            <input
              type="text"
              value={form.account_number}
              onChange={(e) => updateField('account_number', e.target.value)}
              placeholder="Bank-specific number"
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SWIFT/BIC</label>
            <input
              type="text"
              value={form.swift_bic}
              onChange={(e) => updateField('swift_bic', e.target.value)}
              placeholder="e.g. UBSWCHZH80A"
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Nickname or note"
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 text-danger text-sm rounded-md p-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createDocument.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {createDocument.isPending ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function AccountsPage() {
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading, error } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
    latest_only: true,
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
            showForm
              ? 'bg-gray-100 text-text hover:bg-gray-200'
              : 'bg-primary text-white hover:bg-primary/90',
          )}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && <AccountForm onClose={() => setShowForm(false)} />}

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

      {!isLoading && !error && accounts.length === 0 && !showForm && (
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
