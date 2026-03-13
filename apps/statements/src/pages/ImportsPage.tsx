import { useDocuments, useDownloadUrl } from '@wip/react'
import { Download, FileText } from 'lucide-react'
import { Card } from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import { config } from '../lib/config'
import { formatDate } from '../lib/utils'

export default function ImportsPage() {
  const imports = useDocuments({
    template_id: config.templateIds.IMPORT,
    page_size: 100,
    latest_only: true,
  })

  if (imports.isLoading) return <LoadingSpinner />
  if (imports.error) return <ErrorBanner error={imports.error} onRetry={imports.refetch} />

  const items = imports.data?.items ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Imported Files</h2>

      {items.length === 0 ? (
        <EmptyState
          title="No imports yet"
          description="Files will appear here after you import a bank statement or payslip."
        />
      ) : (
        <div className="space-y-3">
          {items.map((doc) => {
            const d = doc.data as Record<string, unknown>
            return (
              <ImportCard
                key={doc.document_id}
                fileId={d.file as string}
                filename={d.filename as string}
                importDate={d.import_date as string}
                documentType={d.document_type as string}
                parser={d.parser as string}
                transactionsCreated={d.transactions_created as number}
                periodFrom={d.period_from as string | undefined}
                periodTo={d.period_to as string | undefined}
                status={d.status as string}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ImportCard({ fileId, filename, importDate, documentType, parser, transactionsCreated, periodFrom, periodTo, status }: {
  fileId: string
  filename: string
  importDate: string
  documentType: string
  parser: string
  transactionsCreated: number
  periodFrom?: string
  periodTo?: string
  status: string
}) {
  const download = useDownloadUrl(fileId)

  const handleDownload = () => {
    if (download.data?.download_url) {
      window.open(download.data.download_url, '_blank')
    }
  }

  const statusColor = status === 'success' ? 'text-success' : status === 'partial' ? 'text-accent' : 'text-danger'

  return (
    <Card className="flex items-center gap-4">
      <div className="shrink-0">
        <FileText className="w-8 h-8 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{filename}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
          <span>{formatDate(importDate)}</span>
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{documentType}</span>
          <span>Parser: {parser}</span>
          <span>{transactionsCreated} docs created</span>
          {periodFrom && periodTo && (
            <span>{formatDate(periodFrom)} — {formatDate(periodTo)}</span>
          )}
          <span className={statusColor}>{status}</span>
        </div>
      </div>
      <button
        onClick={handleDownload}
        disabled={download.isLoading || !download.data?.download_url}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        title="Download original file"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
    </Card>
  )
}
