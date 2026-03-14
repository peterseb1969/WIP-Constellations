import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowLeftRight, Settings2, Search, ChevronLeft, ChevronRight, X, Filter, ChevronDown } from 'lucide-react'
import { useQueryDocuments, useDocuments, useTemplateByValue } from '@wip/react'
import type { Document, QueryFilter } from '@wip/client'
import { formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Column filter types
// ---------------------------------------------------------------------------

type ColumnType = 'text' | 'number' | 'date' | 'enum'

interface ColumnFilter {
  operator: string  // 'contains' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not_empty'
  value: string
}

interface EnumOption {
  value: string
  label: string
}

interface ColumnDef {
  key: string
  label: string
  visible: boolean
  type: ColumnType
  enumOptions?: EnumOption[]
  render?: (value: unknown, doc: Document) => React.ReactNode
}

// ---------------------------------------------------------------------------
// Operator labels per column type
// ---------------------------------------------------------------------------

const OPERATORS: Record<ColumnType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'eq', label: 'Equals' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  number: [
    { value: 'eq', label: 'Equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less or equal' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'eq', label: 'Equals' },
    { value: 'gt', label: 'After' },
    { value: 'gte', label: 'On or after' },
    { value: 'lt', label: 'Before' },
    { value: 'lte', label: 'On or before' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  enum: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
}

// ---------------------------------------------------------------------------
// Transaction type options
// ---------------------------------------------------------------------------

const TX_TYPE_OPTIONS: EnumOption[] = [
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'BANK_TRANSFER_IN', label: 'Transfer In' },
  { value: 'BANK_TRANSFER_OUT', label: 'Transfer Out' },
  { value: 'STANDING_ORDER', label: 'Standing Order' },
  { value: 'E_BILL', label: 'E-Bill' },
  { value: 'CURRENCY_EXCHANGE', label: 'Currency Exchange' },
  { value: 'ATM_WITHDRAWAL', label: 'ATM' },
  { value: 'CREDIT_CARD_PAYMENT', label: 'Credit Card' },
  { value: 'TWINT', label: 'TWINT' },
  { value: 'FEE', label: 'Fee' },
  { value: 'OTHER', label: 'Other' },
]

const CURRENCY_OPTIONS: EnumOption[] = [
  { value: 'CHF', label: 'CHF' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
]

// ---------------------------------------------------------------------------
// Default columns
// ---------------------------------------------------------------------------

function buildDefaultColumns(): ColumnDef[] {
  return [
    {
      key: 'booking_date', label: 'Date', visible: true, type: 'date',
      render: (v) => formatDate(v as string),
    },
    { key: 'description', label: 'Description', visible: true, type: 'text' },
    { key: 'counterparty_name', label: 'Counterparty', visible: true, type: 'text' },
    {
      key: 'amount', label: 'Amount', visible: true, type: 'number',
      render: (v, doc) => {
        const amount = v as number
        return (
          <span className={amount >= 0 ? 'text-success font-medium' : ''}>
            {formatCurrency(amount, doc.data.currency as string)}
          </span>
        )
      },
    },
    { key: 'currency', label: 'Currency', visible: false, type: 'enum', enumOptions: CURRENCY_OPTIONS },
    { key: 'category', label: 'Category', visible: true, type: 'text' },
    { key: 'transaction_type', label: 'Type', visible: true, type: 'enum', enumOptions: TX_TYPE_OPTIONS },
    {
      key: 'balance_after', label: 'Balance', visible: false, type: 'number',
      render: (v) => v != null ? formatCurrency(v as number) : '—',
    },
    { key: 'counterparty_iban', label: 'Counterparty IBAN', visible: false, type: 'text' },
    { key: 'counterparty_address', label: 'Counterparty Address', visible: false, type: 'text' },
    { key: 'reference_number', label: 'Reference', visible: false, type: 'text' },
    { key: 'card_number', label: 'Card', visible: false, type: 'text' },
    { key: 'exchange_rate', label: 'Exchange Rate', visible: false, type: 'number' },
    { key: 'exchange_target_currency', label: 'Target Currency', visible: false, type: 'enum', enumOptions: CURRENCY_OPTIONS },
    {
      key: 'value_date', label: 'Value Date', visible: false, type: 'date',
      render: (v) => v ? formatDate(v as string) : '—',
    },
    { key: 'raw_details', label: 'Raw Details', visible: false, type: 'text' },
    { key: 'source_reference', label: 'Source Ref', visible: false, type: 'text' },
  ]
}

// ---------------------------------------------------------------------------
// Column filter popover
// ---------------------------------------------------------------------------

function ColumnFilterPopover({
  column,
  filter,
  accountOptions,
  onApply,
  onClear,
  onClose,
}: {
  column: ColumnDef
  filter: ColumnFilter | undefined
  accountOptions?: EnumOption[]
  onApply: (f: ColumnFilter) => void
  onClear: () => void
  onClose: () => void
}) {
  const ops = OPERATORS[column.type]
  const [operator, setOperator] = useState(filter?.operator ?? ops[0].value)
  const [value, setValue] = useState(filter?.value ?? '')
  const ref = useRef<HTMLDivElement>(null)

  // Resolve enum options — account column uses dynamic data
  const enumOpts = column.key === 'account' ? accountOptions : column.enumOptions

  const needsValue = operator !== 'empty' && operator !== 'not_empty'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleApply() {
    if (needsValue && !value.trim()) return
    onApply({ operator, value: needsValue ? value.trim() : '' })
    onClose()
  }

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-30 bg-surface border border-gray-200 rounded-lg shadow-lg p-3 min-w-[220px]"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">Filter: {column.label}</span>
        {filter && (
          <button onClick={() => { onClear(); onClose() }} className="text-xs text-danger hover:underline">
            Clear
          </button>
        )}
      </div>

      <select
        value={operator}
        onChange={(e) => setOperator(e.target.value)}
        className="block w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
      >
        {ops.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {needsValue && column.type === 'enum' && enumOpts && (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">Select...</option>
          {enumOpts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {needsValue && column.type === 'date' && (
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      )}

      {needsValue && column.type === 'number' && (
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value..."
          className="block w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      )}

      {needsValue && column.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value..."
          className="block w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      )}

      <button
        onClick={handleApply}
        className="block w-full px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90"
      >
        Apply
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column selector
// ---------------------------------------------------------------------------

function ColumnSelector({
  columns,
  onToggle,
  onClose,
}: {
  columns: ColumnDef[]
  onToggle: (key: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-gray-200 rounded-lg shadow-lg p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Columns</span>
        <button onClick={onClose} className="text-xs text-primary hover:underline">
          Done
        </button>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {columns.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={col.visible}
              onChange={() => onToggle(col.key)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            {col.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Convert column filters to WIP QueryFilters
// ---------------------------------------------------------------------------

function columnFiltersToQuery(columnFilters: Record<string, ColumnFilter>): QueryFilter[] {
  const result: QueryFilter[] = []
  for (const [key, cf] of Object.entries(columnFilters)) {
    const field = `data.${key}`
    switch (cf.operator) {
      case 'contains':
        result.push({ field, operator: 'regex', value: cf.value })
        break
      case 'eq':
        result.push({ field, operator: 'eq', value: cf.value })
        break
      case 'ne':
        result.push({ field, operator: 'ne', value: cf.value })
        break
      case 'gt':
        result.push({ field, operator: 'gt', value: cf.value })
        break
      case 'gte':
        result.push({ field, operator: 'gte', value: cf.value })
        break
      case 'lt':
        result.push({ field, operator: 'lt', value: cf.value })
        break
      case 'lte':
        result.push({ field, operator: 'lte', value: cf.value })
        break
      case 'empty':
        result.push({ field, operator: 'exists', value: false })
        break
      case 'not_empty':
        result.push({ field, operator: 'exists', value: true })
        break
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function TransactionsPage() {
  const [columns, setColumns] = useState(buildDefaultColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  // Top-level quick filters
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [accountId, setAccountId] = useState('')
  const [txType, setTxType] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const { data: templateData } = useTemplateByValue('FIN_TRANSACTION')
  const templateId = templateData?.template_id

  // Load accounts for filter dropdowns
  const { data: accountsData } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
    latest_only: true,
  })
  const accounts = accountsData?.items ?? []
  const accountOptions: EnumOption[] = accounts.map((a) => ({
    value: a.document_id,
    label: `${(a.data.institution as string) ?? ''} — ${(a.data.label as string) ?? (a.data.iban as string) ?? a.document_id}`,
  }))

  const activeColumnFilterCount = Object.keys(columnFilters).length
  const hasTopFilters = searchText || dateFrom || dateTo || accountId || txType
  const hasAnyFilter = hasTopFilters || activeColumnFilterCount > 0

  function clearAllFilters() {
    setSearchText('')
    setDateFrom('')
    setDateTo('')
    setAccountId('')
    setTxType('')
    setColumnFilters({})
    setPage(1)
  }

  function setColumnFilter(key: string, f: ColumnFilter) {
    setColumnFilters((prev) => ({ ...prev, [key]: f }))
    setPage(1)
  }

  function clearColumnFilter(key: string) {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPage(1)
  }

  const filters = useMemo(() => {
    const f: QueryFilter[] = []
    // Top-level quick filters
    if (searchText.trim()) {
      f.push({ field: 'data.description', operator: 'regex', value: searchText.trim() })
    }
    if (dateFrom) {
      f.push({ field: 'data.booking_date', operator: 'gte', value: dateFrom })
    }
    if (dateTo) {
      f.push({ field: 'data.booking_date', operator: 'lte', value: dateTo })
    }
    if (accountId) {
      f.push({ field: 'data.account', operator: 'eq', value: accountId })
    }
    if (txType) {
      f.push({ field: 'data.transaction_type', operator: 'eq', value: txType })
    }
    // Column-level filters
    f.push(...columnFiltersToQuery(columnFilters))
    return f
  }, [searchText, dateFrom, dateTo, accountId, txType, columnFilters])

  const { data, isLoading, error } = useQueryDocuments(
    {
      template_id: templateId,
      filters: filters.length > 0 ? filters : undefined,
      page,
      page_size: pageSize,
      sort_by: 'data.booking_date',
      sort_order: 'desc',
    },
    { enabled: !!templateId },
  )

  const transactions = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const visibleColumns = columns.filter((c) => c.visible)

  function toggleColumn(key: string) {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    )
  }

  function filterSummary(key: string): string | null {
    const f = columnFilters[key]
    if (!f) return null
    if (f.operator === 'empty') return 'empty'
    if (f.operator === 'not_empty') return 'not empty'
    const opLabel = { contains: '~', eq: '=', ne: '\u2260', gt: '>', gte: '\u2265', lt: '<', lte: '\u2264' }[f.operator] ?? f.operator
    return `${opLabel} ${f.value}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowLeftRight size={24} className="text-primary" />
          <h2 className="text-2xl font-semibold">Transactions</h2>
          {!isLoading && (
            <span className="text-sm text-text-muted">
              ({total.toLocaleString()})
            </span>
          )}
        </div>
      </div>

      {/* Quick filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <select
          value={accountId}
          onChange={(e) => { setAccountId(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.document_id} value={a.document_id}>
              {(a.data.institution as string) ?? ''} — {(a.data.label as string) ?? (a.data.iban as string) ?? a.document_id}
            </option>
          ))}
        </select>
        <select
          value={txType}
          onChange={(e) => { setTxType(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">All types</option>
          {TX_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {hasAnyFilter && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-text-muted hover:text-danger"
            title="Clear all filters"
          >
            <X size={14} />
            Clear
          </button>
        )}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md text-sm text-text-muted hover:bg-gray-50"
          >
            <Settings2 size={16} />
            Columns
          </button>
          {showColumnSelector && (
            <ColumnSelector
              columns={columns}
              onToggle={toggleColumn}
              onClose={() => setShowColumnSelector(false)}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 rounded-lg p-4 mb-4">
          <p className="font-medium">Failed to load transactions</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleColumns.map((col) => {
                  const hasFilter = !!columnFilters[col.key]
                  return (
                    <th key={col.key} className="text-left px-4 py-3 font-medium text-text-muted whitespace-nowrap relative">
                      <div className="flex items-center gap-1">
                        {col.label}
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key) }}
                          className={`p-0.5 rounded hover:bg-gray-200 ${hasFilter ? 'text-primary' : 'text-gray-300 hover:text-gray-500'}`}
                          title={hasFilter ? `Filtered: ${filterSummary(col.key)}` : `Filter ${col.label}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === col.key && (
                        <ColumnFilterPopover
                          column={col}
                          filter={columnFilters[col.key]}
                          accountOptions={col.key === 'account' ? accountOptions : undefined}
                          onApply={(f) => setColumnFilter(col.key, f)}
                          onClear={() => clearColumnFilter(col.key)}
                          onClose={() => setOpenFilter(null)}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-text-muted">
                    No transactions found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                transactions.map((doc) => (
                  <tr
                    key={doc.document_id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    {visibleColumns.map((col) => {
                      const value = doc.data[col.key]
                      return (
                        <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                          {col.render
                            ? col.render(value, doc)
                            : (value as string) ?? '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
