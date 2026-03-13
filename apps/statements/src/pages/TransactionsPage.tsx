import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryDocuments, useDocuments, useTerms, useCreateDocument } from '@wip/react'
import type { QueryFilter } from '@wip/client'
import { Settings2, X as XIcon, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import { config } from '../lib/config'
import { formatCurrency, formatDate } from '../lib/utils'

type FilterType = 'text' | 'select-type' | 'select-category' | 'number' | 'none'

interface ColumnDef {
  key: string
  label: string
  defaultVisible: boolean
  render: (d: Record<string, unknown>) => React.ReactNode
  align?: 'left' | 'right'
  filterType: FilterType
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'booking_date', label: 'Booking Date', defaultVisible: true, filterType: 'text',
    render: (d) => formatDate(d.booking_date as string) },
  { key: 'value_date', label: 'Value Date', defaultVisible: false, filterType: 'text',
    render: (d) => d.value_date ? formatDate(d.value_date as string) : '-' },
  { key: 'counterparty_name', label: 'Counterparty', defaultVisible: true, filterType: 'text',
    render: (d) => (d.counterparty_name as string) || '-' },
  { key: 'description', label: 'Description', defaultVisible: true, filterType: 'text',
    render: (d) => (d.description as string) || '-' },
  { key: 'transaction_type', label: 'Type', defaultVisible: true, filterType: 'select-type',
    render: (d) => <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.transaction_type as string}</span> },
  { key: 'category', label: 'Category', defaultVisible: true, filterType: 'select-category', render: () => null /* handled inline */ },
  { key: 'source_reference', label: 'Reference', defaultVisible: false, filterType: 'text',
    render: (d) => <span className="font-mono text-xs">{(d.source_reference as string) || '-'}</span> },
  { key: 'counterparty_iban', label: 'Counterparty IBAN', defaultVisible: false, filterType: 'text',
    render: (d) => <span className="font-mono text-xs">{(d.counterparty_iban as string) || '-'}</span> },
  { key: 'counterparty_address', label: 'Counterparty Address', defaultVisible: false, filterType: 'text',
    render: (d) => (d.counterparty_address as string) || '-' },
  { key: 'reference_number', label: 'Payment Ref', defaultVisible: false, filterType: 'text',
    render: (d) => <span className="font-mono text-xs">{(d.reference_number as string) || '-'}</span> },
  { key: 'card_number', label: 'Card', defaultVisible: false, filterType: 'text',
    render: (d) => (d.card_number as string) || '-' },
  { key: 'balance_after', label: 'Balance After', defaultVisible: false, align: 'right', filterType: 'number',
    render: (d) => d.balance_after != null ? formatCurrency(d.balance_after as number, (d.currency as string) || 'CHF') : '-' },
  { key: 'exchange_rate', label: 'Exchange Rate', defaultVisible: false, align: 'right', filterType: 'number',
    render: (d) => d.exchange_rate != null ? String(d.exchange_rate) : '-' },
  { key: 'currency', label: 'Currency', defaultVisible: false, filterType: 'text',
    render: (d) => (d.currency as string) || '-' },
  { key: 'amount', label: 'Amount', defaultVisible: true, align: 'right', filterType: 'number', render: () => null /* handled inline */ },
]

const STORAGE_KEY = 'statements:tx-columns'
const PAGE_SIZE = 25

function loadVisibleColumns(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
}

function saveVisibleColumns(cols: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]))
}

// Sentinel values for select dropdowns
const EMPTY_SENTINEL = '__empty__'
const NOT_EMPTY_SENTINEL = '__not_empty__'

/** Parse a text filter: "!" = empty, "*" = not empty, "!value" = not equal, else regex */
function parseTextFilter(input: string): Pick<QueryFilter, 'operator' | 'value'> | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed === '!') return { operator: 'exists', value: false }
  if (trimmed === '*') return { operator: 'exists', value: true }
  if (trimmed.startsWith('!')) return { operator: 'ne', value: trimmed.slice(1) }
  return { operator: 'regex', value: trimmed }
}

/** Parse a number filter like ">100", "<=50", "=-20.5", "!", "*", or plain "100" */
function parseNumberFilter(input: string): Pick<QueryFilter, 'operator' | 'value'> | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed === '!') return { operator: 'exists', value: false }
  if (trimmed === '*') return { operator: 'exists', value: true }
  const match = trimmed.match(/^([><=!]{1,2})\s*(-?[\d.,]+)$/)
  if (match) {
    const op = match[1]!
    const num = Number(match[2]!.replace(/,/g, ''))
    if (isNaN(num)) return null
    const opMap: Record<string, QueryFilter['operator']> = {
      '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte', '=': 'eq', '!=': 'ne',
    }
    return { operator: opMap[op] || 'eq', value: num }
  }
  // Plain number — exact match
  const num = Number(trimmed.replace(/,/g, ''))
  if (!isNaN(num)) return { operator: 'eq', value: num }
  return null
}

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accountFilter = searchParams.get('account') || ''

  const [page, setPage] = useState(1)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => loadVisibleColumns())
  const [showColPicker, setShowColPicker] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  // Sorting
  const [sortKey, setSortKey] = useState('booking_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Per-column filters: key → filter value string
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const txTypes = useTerms(config.terminologyIds.TRANSACTION_TYPE, { page_size: 50 })
  const txCategories = useTerms(config.terminologyIds.TRANSACTION_CATEGORY, { page_size: 50 })
  const accountsList = useDocuments({ template_id: config.templateIds.ACCOUNT, page_size: 100, latest_only: true })
  const createDoc = useCreateDocument()

  const setColFilter = useCallback((key: string, value: string) => {
    setColumnFilters(prev => {
      if (!value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
    setPage(1)
  }, [])

  const handleSort = useCallback((key: string) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortOrder(key === 'booking_date' || key === 'value_date' ? 'desc' : 'asc')
      return key
    })
    setPage(1)
  }, [])

  // Build server-side query filters
  const queryFilters = useMemo(() => {
    const filters: QueryFilter[] = []
    if (accountFilter) {
      filters.push({ field: 'data.account', operator: 'eq', value: accountFilter })
    }
    // Column-level filters
    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue
      const col = ALL_COLUMNS.find(c => c.key === key)
      if (!col) continue

      if (col.filterType === 'select-type' || col.filterType === 'select-category') {
        if (value === EMPTY_SENTINEL) {
          filters.push({ field: `data.${key}`, operator: 'exists', value: false })
        } else if (value === NOT_EMPTY_SENTINEL) {
          filters.push({ field: `data.${key}`, operator: 'exists', value: true })
        } else {
          filters.push({ field: `data.${key}`, operator: 'eq', value })
        }
      } else if (col.filterType === 'number') {
        const numFilter = parseNumberFilter(value)
        if (numFilter) {
          filters.push({ field: `data.${key}`, operator: numFilter.operator, value: numFilter.value })
        }
      } else {
        const textFilter = parseTextFilter(value)
        if (textFilter) {
          filters.push({ field: `data.${key}`, operator: textFilter.operator, value: textFilter.value })
        }
      }
    }
    return filters
  }, [accountFilter, columnFilters])

  const transactions = useQueryDocuments({
    template_id: config.templateIds.TRANSACTION,
    filters: queryFilters,
    page,
    page_size: PAGE_SIZE,
    sort_by: `data.${sortKey}`,
    sort_order: sortOrder,
  })

  const toggleColumn = (key: string) => {
    const next = new Set(visibleCols)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setVisibleCols(next)
    saveVisibleColumns(next)
  }

  const handleCategoryChange = useCallback((_docId: string, docData: Record<string, unknown>, newCategory: string) => {
    createDoc.mutate(
      {
        template_id: config.templateIds.TRANSACTION,
        data: { ...docData, category: newCategory || undefined },
      },
      {
        onSuccess: () => {
          setEditingCategoryId(null)
          transactions.refetch()
        },
      },
    )
  }, [createDoc, transactions])

  const hasAnyColumnFilter = Object.keys(columnFilters).length > 0

  if (transactions.isLoading) return <LoadingSpinner />
  if (transactions.error) return <ErrorBanner error={transactions.error} onRetry={transactions.refetch} />

  const items = transactions.data?.items ?? []
  const total = transactions.data?.total ?? 0
  const totalPages = transactions.data?.pages ?? 1

  const setAccountFilter = (docId: string) => {
    if (docId) {
      searchParams.set('account', docId)
    } else {
      searchParams.delete('account')
    }
    setSearchParams(searchParams)
    setPage(1)
  }

  const resolveAccountLabel = (docId: string): string => {
    const acc = accountsList.data?.items.find(a => a.document_id === docId)
    if (!acc) return docId.substring(0, 12) + '...'
    const ad = acc.data as Record<string, unknown>
    return `${ad.institution as string} (${ad.iban as string})`
  }

  const clearAllFilters = () => {
    setColumnFilters({})
    setAccountFilter('')
    setPage(1)
  }

  const columns = ALL_COLUMNS.filter(c => visibleCols.has(c.key))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">{total} {accountFilter || hasAnyColumnFilter ? 'matched' : 'total'}</span>
          {(accountFilter || hasAnyColumnFilter) && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-danger/30 text-danger rounded-md hover:bg-danger/5 transition-colors"
            >
              <XIcon className="w-3 h-3" />
              Clear all
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50 transition-colors"
              title="Configure columns"
            >
              <Settings2 className="w-4 h-4" />
              Columns
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-3 z-50 w-64 max-h-80 overflow-y-auto">
                <p className="text-xs font-semibold text-text-muted mb-2 uppercase">Toggle Columns</p>
                {ALL_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:text-primary">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active account filter banner */}
      {accountFilter && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
          <span className="text-sm">Filtered by account: <strong>{resolveAccountLabel(accountFilter)}</strong></span>
          <button onClick={() => setAccountFilter('')} className="ml-auto text-text-muted hover:text-danger transition-colors" title="Clear filter">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account-level filter (not a column, so stays here) */}
      <div className="flex flex-wrap gap-3">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Accounts</option>
          {accountsList.data?.items.map((doc) => {
            const ad = doc.data as Record<string, unknown>
            return (
              <option key={doc.document_id} value={doc.document_id}>
                {ad.institution as string} ({ad.iban as string})
              </option>
            )
          })}
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No transactions"
          description={total === 0 && !accountFilter && !hasAnyColumnFilter
            ? 'Import a bank statement to see transactions here.'
            : 'No transactions match your filters.'}
        />
      ) : (
        <>
          <div className="bg-surface border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Header row — sortable */}
                <tr className="border-b bg-gray-50">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-semibold whitespace-nowrap select-none cursor-pointer hover:text-primary transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortOrder === 'asc'
                            ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
                            : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-gray-300" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
                {/* Filter row */}
                <tr className="border-b bg-gray-50/50">
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-1.5">
                      <ColumnFilter
                        col={col}
                        value={columnFilters[col.key] || ''}
                        onChange={(v) => setColFilter(col.key, v)}
                        txTypes={txTypes.data?.items}
                        txCategories={txCategories.data?.items}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((doc) => {
                  const d = doc.data as Record<string, unknown>
                  return (
                    <tr key={doc.document_id} className="hover:bg-gray-50 transition-colors">
                      {columns.map((col) => {
                        // Special: Amount column
                        if (col.key === 'amount') {
                          const amount = d.amount as number
                          return (
                            <td key={col.key} className={`px-4 py-3 text-right font-medium whitespace-nowrap ${amount >= 0 ? 'text-success' : 'text-danger'}`}>
                              {formatCurrency(amount, (d.currency as string) || 'CHF')}
                            </td>
                          )
                        }
                        // Special: Category column — inline editable
                        if (col.key === 'category') {
                          const isEditing = editingCategoryId === doc.document_id
                          const currentCat = d.category as string | undefined
                          if (isEditing) {
                            return (
                              <td key={col.key} className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <select
                                    defaultValue={currentCat || ''}
                                    onChange={(e) => handleCategoryChange(doc.document_id, d, e.target.value)}
                                    className="border rounded px-2 py-1 text-xs w-32"
                                    autoFocus
                                  >
                                    <option value="">None</option>
                                    {txCategories.data?.items.map((t) => (
                                      <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => setEditingCategoryId(null)} className="p-0.5 text-text-muted hover:text-danger">
                                    <XIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )
                          }
                          return (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-text-muted cursor-pointer hover:text-primary transition-colors"
                              onClick={() => setEditingCategoryId(doc.document_id)}
                              title="Click to assign category"
                            >
                              {currentCat ? (
                                <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">{currentCat}</span>
                              ) : (
                                <span className="text-xs italic">click to set</span>
                              )}
                            </td>
                          )
                        }
                        // Default column rendering
                        return (
                          <td key={col.key} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''} ${col.key === 'description' ? 'max-w-xs truncate' : ''}`}>
                            {col.render(d)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50">
                Previous
              </button>
              <span className="text-sm text-text-muted">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Per-column filter input — renders the appropriate control based on filterType */
function ColumnFilter({ col, value, onChange, txTypes, txCategories }: {
  col: ColumnDef
  value: string
  onChange: (v: string) => void
  txTypes?: Array<{ term_id: string; value: string; label?: string }>
  txCategories?: Array<{ term_id: string; value: string; label?: string }>
}) {
  if (col.filterType === 'none') return null

  const terms = col.filterType === 'select-type' ? txTypes : col.filterType === 'select-category' ? txCategories : undefined

  if (terms) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-1.5 py-1 text-xs font-normal bg-white"
      >
        <option value="">All</option>
        <option value={EMPTY_SENTINEL}>(Empty)</option>
        <option value={NOT_EMPTY_SENTINEL}>(Not empty)</option>
        {terms.map((t) => (
          <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
        ))}
      </select>
    )
  }

  if (col.filterType === 'number') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=">0  <-100  !  *"
        title="Operators: > >= < <= = != or plain number. ! = empty, * = not empty"
        className={`w-full border rounded px-1.5 py-1 text-xs font-normal ${col.align === 'right' ? 'text-right' : ''}`}
      />
    )
  }

  // text
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter...  !  *"
      title="Type to search. ! = empty, * = not empty, !value = exclude"
      className="w-full border rounded px-1.5 py-1 text-xs font-normal"
    />
  )
}
