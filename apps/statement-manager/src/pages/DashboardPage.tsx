import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  FileText,
  Upload,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useDocuments } from '@wip/react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Document } from '@wip/client'

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: typeof Landmark
  label: string
  value: string | number
  subtitle?: string
}) {
  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-md">
          <Icon size={18} className="text-primary" />
        </div>
        <span className="text-sm text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  )
}

function RecentTransactions({ transactions }: { transactions: Document[] }) {
  if (transactions.length === 0) {
    return (
      <p className="text-text-muted text-sm py-4">No transactions yet.</p>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {transactions.map((doc) => {
        const d = doc.data as Record<string, unknown>
        const amount = d.amount as number
        const isIncome = amount > 0

        return (
          <div key={doc.document_id} className="flex items-center gap-3 py-3">
            <div className={`p-1.5 rounded-md ${isIncome ? 'bg-success/10' : 'bg-danger/10'}`}>
              {isIncome ? (
                <TrendingUp size={16} className="text-success" />
              ) : (
                <TrendingDown size={16} className="text-danger" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {(d.counterparty_name as string) || (d.description as string) || 'Transaction'}
              </p>
              <p className="text-xs text-text-muted">
                {formatDate(d.booking_date as string)}
              </p>
            </div>
            <span className={`text-sm font-medium ${isIncome ? 'text-success' : 'text-text'}`}>
              {formatCurrency(amount, d.currency as string)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardPage() {
  const { data: accountsData, isLoading: loadingAccounts } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
  })
  const { data: txData, isLoading: loadingTx } = useDocuments({
    template_value: 'FIN_TRANSACTION',
    page_size: 10,
  })
  const { data: payslipData, isLoading: loadingPayslips } = useDocuments({
    template_value: 'FIN_PAYSLIP',
    page_size: 1,
  })
  const { data: importData, isLoading: loadingImports } = useDocuments({
    template_value: 'FIN_IMPORT',
    page_size: 1,
  })

  const isLoading = loadingAccounts || loadingTx || loadingPayslips || loadingImports
  const accounts = accountsData?.items ?? []
  const transactions = txData?.items ?? []
  const totalTransactions = txData?.total ?? 0
  const totalPayslips = payslipData?.total ?? 0
  const totalImports = importData?.total ?? 0

  const lastImport = importData?.items?.[0]
  const lastImportDate = lastImport
    ? formatDate(lastImport.data.import_date as string)
    : 'Never'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Dashboard</h2>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Landmark}
              label="Accounts"
              value={accounts.length}
            />
            <StatCard
              icon={ArrowLeftRight}
              label="Transactions"
              value={totalTransactions.toLocaleString()}
            />
            <StatCard
              icon={FileText}
              label="Payslips"
              value={totalPayslips}
            />
            <StatCard
              icon={Upload}
              label="Last Import"
              value={lastImportDate}
              subtitle={`${totalImports} total imports`}
            />
          </div>

          <div className="bg-surface border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4">Recent Transactions</h3>
            <RecentTransactions transactions={transactions} />
          </div>
        </>
      )}
    </div>
  )
}
