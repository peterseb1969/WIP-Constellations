import { useState, useMemo } from 'react'
import { ArrowLeftRight, Settings2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQueryDocuments, useTemplateByValue } from '@wip/react'
import type { Document, QueryFilter } from '@wip/client'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ColumnDef {
  key: string
  label: string
  visible: boolean
  render?: (value: unknown, doc: Document) => React.ReactNode
}

function buildDefaultColumns(): ColumnDef[] {
  return [
    {
      key: 'booking_date',
      label: 'Date',
      visible: true,
      render: (v) => formatDate(v as string),
    },
    { key: 'description', label: 'Description', visible: true },
    { key: 'counterparty_name', label: 'Counterparty', visible: true },
    {
      key: 'amount',
      label: 'Amount',
      visible: true,
      render: (v, doc) => {
        const amount = v as number
        return (
          <span className={amount >= 0 ? 'text-success font-medium' : ''}>
            {formatCurrency(amount, doc.data.currency as string)}
          </span>
        )
      },
    },
    { key: 'currency', label: 'Currency', visible: false },
    { key: 'category', label: 'Category', visible: true },
    { key: 'transaction_type', label: 'Type', visible: true },
    { key: 'balance_after', label: 'Balance', visible: false,
      render: (v) => v != null ? formatCurrency(v as number) : '—',
    },
    { key: 'counterparty_iban', label: 'Counterparty IBAN', visible: false },
    { key: 'counterparty_address', label: 'Counterparty Address', visible: false },
    { key: 'reference_number', label: 'Reference', visible: false },
    { key: 'card_number', label: 'Card', visible: false },
    { key: 'exchange_rate', label: 'Exchange Rate', visible: false },
    { key: 'exchange_target_currency', label: 'Target Currency', visible: false },
    { key: 'value_date', label: 'Value Date', visible: false,
      render: (v) => v ? formatDate(v as string) : '—',
    },
    { key: 'raw_details', label: 'Raw Details', visible: false },
    { key: 'source_reference', label: 'Source Ref', visible: false },
  ]
}

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

export function TransactionsPage() {
  const [columns, setColumns] = useState(buildDefaultColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const { data: templateData } = useTemplateByValue('FIN_TRANSACTION')
  const templateId = templateData?.template_id

  const filters = useMemo(() => {
    const f: QueryFilter[] = []
    if (searchText.trim()) {
      f.push({ field: 'data.description', operator: 'regex', value: searchText.trim() })
    }
    return f
  }, [searchText])

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

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="relative">
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
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-medium text-text-muted whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
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
