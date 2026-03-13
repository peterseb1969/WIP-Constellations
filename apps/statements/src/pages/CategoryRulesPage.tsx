import { useState, useCallback } from 'react'
import { useTerms, useDocuments, useCreateDocument } from '@wip/react'
import { Plus, X, Pencil, Trash2, Play, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardTitle } from '../components/Card'
import { config } from '../lib/config'
import { CategoryRule, loadRules, saveRules, matchCategory } from '../lib/category-rules'

interface RuleFormData {
  pattern: string
  category: string
  priority: number
}

export default function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>(() => loadRules())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<RuleFormData>({ pattern: '', category: '', priority: 10 })
  const [applyStatus, setApplyStatus] = useState<{
    running: boolean
    processed: number
    matched: number
    updated: number
    errors: number
    total: number
    done: boolean
  } | null>(null)

  const categories = useTerms(config.terminologyIds.TRANSACTION_CATEGORY, { page_size: 50 })
  const transactions = useDocuments({
    template_id: config.templateIds.TRANSACTION,
    page_size: 200,
    latest_only: true,
  })
  const createDoc = useCreateDocument()

  const categoryLabel = useCallback(
    (value: string) => {
      const term = categories.data?.items.find((t) => t.value === value)
      return term?.label || term?.value || value
    },
    [categories.data],
  )

  const persistRules = (updated: CategoryRule[]) => {
    setRules(updated)
    saveRules(updated)
  }

  const openAddForm = () => {
    setEditingId(null)
    setFormData({ pattern: '', category: '', priority: 10 })
    setShowForm(true)
  }

  const openEditForm = (rule: CategoryRule) => {
    setEditingId(rule.id)
    setFormData({ pattern: rule.pattern, category: rule.category, priority: rule.priority })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.pattern.trim() || !formData.category) return

    if (editingId) {
      const updated = rules.map((r) =>
        r.id === editingId ? { ...r, pattern: formData.pattern.trim(), category: formData.category, priority: formData.priority } : r,
      )
      persistRules(updated)
    } else {
      const newRule: CategoryRule = {
        id: crypto.randomUUID(),
        pattern: formData.pattern.trim(),
        category: formData.category,
        priority: formData.priority,
      }
      persistRules([...rules, newRule])
    }
    closeForm()
  }

  const deleteRule = (id: string) => {
    persistRules(rules.filter((r) => r.id !== id))
  }

  const applyRules = async () => {
    if (!transactions.data?.items || rules.length === 0) return

    const uncategorized = transactions.data.items.filter((doc) => {
      const d = doc.data as Record<string, unknown>
      return !d.category
    })

    setApplyStatus({ running: true, processed: 0, matched: 0, updated: 0, errors: 0, total: uncategorized.length, done: false })

    let matched = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < uncategorized.length; i++) {
      const doc = uncategorized[i]!
      const d = doc.data as Record<string, unknown>
      const description = (d.description as string) || ''
      const counterparty = (d.counterparty_name as string) || ''

      const matchedCategory = matchCategory(description, counterparty, rules)
      if (matchedCategory) {
        matched++
        try {
          await new Promise<void>((resolve, reject) => {
            createDoc.mutate(
              {
                template_id: config.templateIds.TRANSACTION,
                data: {
                  ...d,
                  category: matchedCategory,
                },
              },
              {
                onSuccess: () => resolve(),
                onError: (err) => reject(err),
              },
            )
          })
          updated++
        } catch {
          errors++
        }
      }

      setApplyStatus((prev) =>
        prev ? { ...prev, processed: i + 1, matched, updated, errors } : null,
      )
    }

    setApplyStatus((prev) => (prev ? { ...prev, running: false, done: true } : null))
    transactions.refetch()
  }

  const uncategorizedCount = transactions.data?.items.filter((doc) => {
    const d = doc.data as Record<string, unknown>
    return !d.category
  }).length ?? 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Category Rules</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={applyRules}
            disabled={applyStatus?.running || rules.length === 0 || uncategorizedCount === 0}
            className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            <Play className="w-4 h-4" />
            Apply Rules ({uncategorizedCount} uncategorized)
          </button>
          <button
            onClick={() => { if (showForm) closeForm(); else openAddForm() }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Rule'}
          </button>
        </div>
      </div>

      {/* Apply Results */}
      {applyStatus && (
        <Card>
          <div className="flex items-start gap-3">
            {applyStatus.running ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mt-0.5" />
            ) : applyStatus.errors > 0 ? (
              <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success mt-0.5" />
            )}
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {applyStatus.running
                  ? `Processing... ${applyStatus.processed} / ${applyStatus.total}`
                  : 'Rule application complete'}
              </p>
              <p className="text-text-muted">
                {applyStatus.matched} matched, {applyStatus.updated} updated
                {applyStatus.errors > 0 && <span className="text-danger">, {applyStatus.errors} errors</span>}
              </p>
              {!applyStatus.running && applyStatus.total - applyStatus.matched > 0 && (
                <p className="text-text-muted">
                  {applyStatus.total - applyStatus.matched} transactions had no matching rule.
                </p>
              )}
            </div>
            {applyStatus.done && (
              <button
                onClick={() => setApplyStatus(null)}
                className="ml-auto text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold mb-4">{editingId ? 'Edit Rule' : 'New Rule'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Pattern *</label>
                <input
                  value={formData.pattern}
                  onChange={(e) => setFormData((f) => ({ ...f, pattern: e.target.value }))}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. MIGROS, Spotify, SBB"
                />
                <p className="text-xs text-text-muted mt-1">Case-insensitive substring match on description and counterparty.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {categories.data?.items.map((t) => (
                    <option key={t.term_id} value={t.value}>
                      {t.label || t.value}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
                <p className="text-xs text-text-muted mt-1">Higher priority rules match first.</p>
              </div>
            </div>
            <button
              type="submit"
              className="bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {editingId ? 'Save Changes' : 'Add Rule'}
            </button>
          </form>
        </Card>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-text-muted mb-2">No rules yet.</p>
            <p className="text-sm text-text-muted">
              Add rules to automatically assign categories to transactions based on description or counterparty patterns.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Rules ({rules.length})</CardTitle>
          <div className="divide-y">
            {[...rules]
              .sort((a, b) => b.priority - a.priority)
              .map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs text-text-muted w-8 text-right shrink-0">#{rule.priority}</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded truncate">{rule.pattern}</span>
                    <span className="text-sm text-text-muted shrink-0">&rarr;</span>
                    <span className="text-sm font-medium truncate">{categoryLabel(rule.category)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(rule)}
                      className="p-1.5 text-text-muted hover:text-primary transition-colors rounded"
                      title="Edit rule"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-text-muted hover:text-danger transition-colors rounded"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}
