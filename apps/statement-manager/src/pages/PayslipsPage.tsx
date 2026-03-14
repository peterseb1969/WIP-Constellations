import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useDocuments, useQueryDocuments, useTemplateByValue } from '@wip/react'
import type { Document } from '@wip/client'
import { formatCurrency, formatDate } from '@/lib/utils'

function PayslipLineItems({ payslipId }: { payslipId: string }) {
  const { data: templateData } = useTemplateByValue('FIN_PAYSLIP_LINE')
  const templateId = templateData?.template_id

  const { data, isLoading } = useQueryDocuments(
    {
      template_id: templateId,
      filters: [{ field: 'data.payslip', operator: 'eq', value: payslipId }],
      page_size: 50,
      sort_by: 'data.is_deduction',
      sort_order: 'asc',
    },
    { enabled: !!templateId },
  )

  const lines = data?.items ?? []
  const earnings = lines.filter((l) => !(l.data.is_deduction as boolean))
  const deductions = lines.filter((l) => l.data.is_deduction as boolean)

  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  function LineTable({ items, title, color }: { items: Document[]; title: string; color: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <h5 className={`text-sm font-medium mb-2 ${color}`}>{title}</h5>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="pb-1 font-medium">Code</th>
              <th className="pb-1 font-medium">Description</th>
              <th className="pb-1 font-medium">Category</th>
              <th className="pb-1 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.document_id} className="border-t border-gray-100">
                <td className="py-1.5 font-mono text-xs">{item.data.code as string}</td>
                <td className="py-1.5">{item.data.description as string}</td>
                <td className="py-1.5 text-text-muted">{item.data.category as string}</td>
                <td className="py-1.5 text-right font-medium">
                  {formatCurrency(item.data.amount as number)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4 pl-4 border-l-2 border-primary/20">
      <LineTable items={earnings} title="Earnings" color="text-success" />
      <LineTable items={deductions} title="Deductions" color="text-danger" />
    </div>
  )
}

function PayslipCard({ doc }: { doc: Document }) {
  const [expanded, setExpanded] = useState(false)
  const d = doc.data as Record<string, unknown>

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">{d.period as string}</h3>
            <p className="text-sm text-text-muted mt-0.5">
              Pay date: {formatDate(d.pay_date as string)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-text-muted">Gross</p>
              <p className="font-medium">{formatCurrency(d.gross as number, d.currency as string)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Net</p>
              <p className="font-semibold text-success">
                {formatCurrency(d.net as number, d.currency as string)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Payment</p>
              <p className="font-semibold">
                {formatCurrency(d.payment_amount as number, d.currency as string)}
              </p>
            </div>
            {expanded ? (
              <ChevronUp size={20} className="text-text-muted" />
            ) : (
              <ChevronDown size={20} className="text-text-muted" />
            )}
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 mt-3 text-xs text-text-muted">
          {d.total_social_contributions != null && (
            <span>Social: {formatCurrency(d.total_social_contributions as number)}</span>
          )}
          {d.total_pension_contributions != null && (
            <span>Pension: {formatCurrency(d.total_pension_contributions as number)}</span>
          )}
          {d.total_deductions != null && (
            <span>Total deductions: {formatCurrency(d.total_deductions as number)}</span>
          )}
          {d.capacity_utilization != null && (
            <span>Capacity: {d.capacity_utilization as number}%</span>
          )}
        </div>
      </button>

      {expanded && <PayslipLineItems payslipId={doc.document_id} />}
    </div>
  )
}

export function PayslipsPage() {
  const { data, isLoading, error } = useDocuments({
    template_value: 'FIN_PAYSLIP',
    page_size: 50,
  })

  const payslips = data?.items ?? []

  // Sort by period descending
  const sorted = [...payslips].sort((a, b) =>
    (b.data.period as string).localeCompare(a.data.period as string),
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Payslips</h2>
        {!isLoading && (
          <span className="text-sm text-text-muted">({payslips.length})</span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 rounded-lg p-4">
          <p className="font-medium">Failed to load payslips</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No payslips yet</p>
          <p className="text-sm mt-1">Import a payslip PDF to get started.</p>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map((doc) => (
            <PayslipCard key={doc.document_id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
