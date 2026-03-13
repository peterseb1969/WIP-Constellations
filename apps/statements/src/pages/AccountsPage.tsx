import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocuments, useCreateDocument, useTerms } from '@wip/react'
import { Plus, X, Pencil } from 'lucide-react'
import { Card } from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import { config } from '../lib/config'

interface AccountFormData {
  iban: string
  institution: string
  account_type: string
  primary_currency: string
  holder_name?: string
  description?: string
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<{ id: string; data: AccountFormData } | null>(null)

  const accounts = useDocuments({ template_id: config.templateIds.ACCOUNT, page_size: 100, latest_only: true })
  const accountTypes = useTerms(config.terminologyIds.ACCOUNT_TYPE, { page_size: 50 })
  const currencies = useTerms(config.terminologyIds.CURRENCY, { page_size: 50 })
  const createDoc = useCreateDocument()

  if (accounts.isLoading) return <LoadingSpinner />
  if (accounts.error) return <ErrorBanner error={accounts.error} onRetry={accounts.refetch} />

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createDoc.mutate(
      {
        template_id: config.templateIds.ACCOUNT,
        data: {
          iban: (fd.get('iban') as string).replace(/\s/g, ''),
          institution: fd.get('institution') as string,
          account_type: fd.get('account_type') as string,
          primary_currency: fd.get('primary_currency') as string,
          holder_name: (fd.get('holder_name') as string) || undefined,
          description: (fd.get('description') as string) || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setEditingAccount(null)
          accounts.refetch()
        },
      },
    )
  }

  const openEdit = (e: React.MouseEvent, docId: string, data: Record<string, unknown>) => {
    e.stopPropagation()
    setEditingAccount({
      id: docId,
      data: {
        iban: data.iban as string,
        institution: data.institution as string,
        account_type: data.account_type as string,
        primary_currency: data.primary_currency as string,
        holder_name: (data.holder_name as string) || undefined,
        description: (data.description as string) || undefined,
      },
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingAccount(null)
  }

  const navigateToTransactions = (docId: string) => {
    navigate(`/transactions?account=${docId}`)
  }

  const isEditing = editingAccount !== null
  const formDefaults = editingAccount?.data

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Accounts</h2>
        <button
          onClick={() => { if (showForm) closeForm(); else setShowForm(true) }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold mb-4">{isEditing ? 'Edit Account' : 'New Account'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">IBAN *</label>
                <input
                  name="iban"
                  required
                  readOnly={isEditing}
                  defaultValue={formDefaults?.iban}
                  className="w-full border rounded-md px-3 py-2 text-sm read-only:bg-gray-50 read-only:text-text-muted"
                  placeholder="CH92 0029 3293 1008 6640 Y"
                />
                {isEditing && <p className="text-xs text-text-muted mt-1">IBAN is the identity field and cannot be changed.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Institution *</label>
                <input name="institution" required defaultValue={formDefaults?.institution} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="UBS" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Type *</label>
                <select name="account_type" required defaultValue={formDefaults?.account_type} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {accountTypes.data?.items.map((t) => (
                    <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Currency *</label>
                <select name="primary_currency" required defaultValue={formDefaults?.primary_currency} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {currencies.data?.items.map((t) => (
                    <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Holder Name</label>
                <input name="holder_name" defaultValue={formDefaults?.holder_name} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input name="description" defaultValue={formDefaults?.description} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Main checking account" />
              </div>
            </div>
            {createDoc.error && <ErrorBanner error={createDoc.error} />}
            <button
              type="submit"
              disabled={createDoc.isPending}
              className="bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createDoc.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Account'}
            </button>
          </form>
        </Card>
      )}

      {accounts.data?.items.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first bank account to get started."
          action={
            <button onClick={() => setShowForm(true)} className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium">
              Add Account
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.data?.items.map((doc) => {
            const d = doc.data as Record<string, unknown>
            return (
              <Card
                key={doc.document_id}
                className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
              >
                <div
                  className="space-y-2"
                  onClick={() => navigateToTransactions(doc.document_id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {d.account_type as string}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{d.primary_currency as string}</span>
                      <button
                        onClick={(e) => openEdit(e, doc.document_id, d)}
                        className="p-1 text-text-muted hover:text-primary transition-colors rounded"
                        title="Edit account"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold">{d.institution as string}</p>
                  <p className="text-sm text-text-muted font-mono">{d.iban as string}</p>
                  {typeof d.holder_name === 'string' && d.holder_name && (
                    <p className="text-sm text-text-muted">{d.holder_name}</p>
                  )}
                  {typeof d.description === 'string' && d.description && (
                    <p className="text-sm text-text-muted italic">{d.description}</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
