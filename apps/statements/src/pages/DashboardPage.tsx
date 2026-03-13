import { Link } from 'react-router-dom'
import { useDocuments } from '@wip/react'
import { Landmark, ArrowLeftRight, FileText } from 'lucide-react'
import { Card, CardTitle, CardValue } from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import { config } from '../lib/config'
import { formatCurrency, formatDate } from '../lib/utils'

export default function DashboardPage() {
  const accounts = useDocuments({ template_id: config.templateIds.ACCOUNT, page_size: 100, latest_only: true })
  const transactions = useDocuments({
    template_id: config.templateIds.TRANSACTION,
    page_size: 5,
    latest_only: true,
  })
  const payslips = useDocuments({ template_id: config.templateIds.PAYSLIP, page_size: 100, latest_only: true })

  const isLoading = accounts.isLoading || transactions.isLoading || payslips.isLoading
  const error = accounts.error || transactions.error || payslips.error

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorBanner error={error} onRetry={() => { accounts.refetch(); transactions.refetch(); payslips.refetch() }} />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Summary cards — clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="accounts">
          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Landmark className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Accounts</CardTitle>
                <CardValue>{accounts.data?.total ?? 0}</CardValue>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="transactions">
          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <ArrowLeftRight className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardValue>{transactions.data?.total ?? 0}</CardValue>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="payslips">
          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <FileText className="w-5 h-5 text-success" />
              </div>
              <div>
                <CardTitle>Pay Slips</CardTitle>
                <CardValue>{payslips.data?.total ?? 0}</CardValue>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent transactions */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="mb-0">Recent Transactions</CardTitle>
          {(transactions.data?.total ?? 0) > 5 && (
            <Link to="transactions" className="text-xs text-primary-light hover:text-primary transition-colors">
              View all
            </Link>
          )}
        </div>
        {transactions.data?.items.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No transactions yet. Import a bank statement to get started.</p>
        ) : (
          <div className="divide-y">
            {transactions.data?.items.map((doc) => {
              const d = doc.data as Record<string, unknown>
              return (
                <div key={doc.document_id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{(d.description as string) || (d.counterparty_name as string) || 'Transaction'}</p>
                    <p className="text-xs text-text-muted">{formatDate(d.booking_date as string)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${(d.amount as number) >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(d.amount as number, (d.currency as string) || 'CHF')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
