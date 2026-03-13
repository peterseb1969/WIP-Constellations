import { useState } from 'react'
import { useDocuments } from '@wip/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import { config } from '../lib/config'
import { formatCurrency, formatMonth } from '../lib/utils'

export default function PayslipsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const payslips = useDocuments({
    template_id: config.templateIds.PAYSLIP,
    page_size: 50,
    latest_only: true,
  })

  const payslipLines = useDocuments({
    template_id: config.templateIds.PAYSLIP_LINE,
    page_size: 200,
    latest_only: true,
  })

  if (payslips.isLoading) return <LoadingSpinner />
  if (payslips.error) return <ErrorBanner error={payslips.error} onRetry={payslips.refetch} />

  const items = payslips.data?.items ?? []

  if (items.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold">Pay Slips</h2>
        <EmptyState title="No pay slips yet" description="Pay slip data can be added manually or via import." />
      </div>
    )
  }

  // Group lines by payslip document_id
  const linesByPayslip = new Map<string, Array<Record<string, unknown>>>()
  for (const lineDoc of payslipLines.data?.items ?? []) {
    const d = lineDoc.data as Record<string, unknown>
    const payslipRef = d.payslip as string
    if (payslipRef) {
      const existing = linesByPayslip.get(payslipRef) ?? []
      existing.push(d)
      linesByPayslip.set(payslipRef, existing)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Pay Slips</h2>

      <div className="space-y-4">
        {items.map((doc) => {
          const d = doc.data as Record<string, unknown>
          const isExpanded = expandedId === doc.document_id
          const lines = linesByPayslip.get(doc.document_id) ?? []

          return (
            <Card key={doc.document_id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : doc.document_id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{formatMonth(d.period as string)}</p>
                    <p className="text-sm text-text-muted">Employee #{d.employee_number as string}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Gross</p>
                      <p className="font-semibold">{formatCurrency(d.gross as number, (d.currency as string) || 'CHF')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Net</p>
                      <p className="font-semibold text-success">{formatCurrency(d.net as number, (d.currency as string) || 'CHF')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Payment</p>
                      <p className="font-semibold">{formatCurrency(d.payment_amount as number, (d.currency as string) || 'CHF')}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                  </div>
                </div>
              </button>

              {isExpanded && lines.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted text-xs">
                        <th className="text-left py-1">Code</th>
                        <th className="text-left py-1">Description</th>
                        <th className="text-left py-1">Category</th>
                        <th className="text-right py-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((line, i) => (
                        <tr key={i}>
                          <td className="py-2 font-mono text-xs">{line.code as string}</td>
                          <td className="py-2">{line.description as string}</td>
                          <td className="py-2 text-text-muted">{line.category as string}</td>
                          <td className={`py-2 text-right font-medium ${line.is_deduction ? 'text-danger' : 'text-success'}`}>
                            {line.is_deduction ? '-' : '+'}{formatCurrency(Math.abs(line.amount as number), 'CHF')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isExpanded && lines.length === 0 && (
                <p className="mt-4 text-sm text-text-muted border-t pt-4">No line items available.</p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
