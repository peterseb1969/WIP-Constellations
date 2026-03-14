import { useState, useCallback } from 'react'
import { Upload, FileDown, CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react'
import {
  useDocuments,
  useDownloadUrl,
  useCreateDocument,
  useCreateDocuments,
  useUploadFile,
  useTemplateByValue,
} from '@wip/react'
import type { Document, CreateDocumentRequest } from '@wip/client'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { parseUbsCsv, toWipTransaction } from '@/lib/parsers/ubs-csv'
import type { ParsedUbsCsv } from '@/lib/parsers/ubs-csv'

function DownloadButton({ fileId, filename }: { fileId: string; filename: string }) {
  const { isLoading, refetch } = useDownloadUrl(fileId)

  async function handleDownload() {
    const result = await refetch()
    const url = result.data?.download_url
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className="flex items-center gap-1 text-primary text-sm hover:underline disabled:opacity-50"
      title="Download original file"
    >
      <FileDown size={14} />
      Download
    </button>
  )
}

function ImportHistoryItem({ doc }: { doc: Document }) {
  const d = doc.data as Record<string, unknown>
  const status = d.status as string
  const fileId = d.file as string | undefined
  const filename = d.filename as string

  const StatusIcon = status === 'success' ? CheckCircle : status === 'failed' ? AlertCircle : Clock
  const statusColor = status === 'success' ? 'text-success' : status === 'failed' ? 'text-danger' : 'text-accent'

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <StatusIcon size={18} className={statusColor} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <div className="flex gap-3 text-xs text-text-muted mt-0.5">
          <span>{formatDate(d.import_date as string)}</span>
          <span>{d.document_type as string}</span>
          <span>{d.parser as string}</span>
          <span>{d.transactions_created as number} items created</span>
        </div>
      </div>
      <span className={cn('text-xs font-medium px-2 py-0.5 rounded', {
        'bg-success/10 text-success': status === 'success',
        'bg-danger/10 text-danger': status === 'failed',
        'bg-accent/10 text-accent': status === 'partial',
      })}>
        {status}
      </span>
      {fileId && <DownloadButton fileId={fileId} filename={filename} />}
    </div>
  )
}

interface ImportPreviewProps {
  file: File
  parsed: ParsedUbsCsv
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

function ImportPreview({ file, parsed, accounts, onCancel, onImported }: ImportPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const { data: txTemplate } = useTemplateByValue('FIN_TRANSACTION')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')

  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const uploadFile = useUploadFile()

  // Auto-select account if IBAN matches
  const matchingAccount = accounts.find((a) => {
    const iban = (a.data.iban as string)?.replace(/\s/g, '')
    return iban === parsed.header.iban
  })

  const effectiveAccountId = selectedAccountId || matchingAccount?.document_id || ''

  // Convert transactions to WIP format for preview
  const wipTransactions = parsed.transactions
    .map((tx) => toWipTransaction(tx, effectiveAccountId))
    .filter((t): t is Record<string, unknown> => t !== null)

  const skippedCount = parsed.transactions.length - wipTransactions.length

  async function handleImport() {
    if (!txTemplate?.template_id || !importTemplate?.template_id || !effectiveAccountId) return

    setImporting(true)
    setResult(null)

    try {
      // 1. Create transactions in batches
      const docs: CreateDocumentRequest[] = wipTransactions.map((data) => ({
        template_id: txTemplate.template_id,
        data: { ...data, account: effectiveAccountId },
      }))

      let totalCreated = 0
      const errors: string[] = []
      const batchSize = 50

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize)
        const res = await createDocs.mutateAsync(batch)
        totalCreated += res.results.filter((r) => r.status === 'created' || r.status === 'updated').length
        res.results
          .filter((r) => r.status === 'error')
          .forEach((r) => errors.push(r.error ?? 'Unknown error'))
      }

      // 2. Upload the original file
      const fileEntity = await uploadFile.mutateAsync({
        file,
        filename: file.name,
      })

      // 3. Create FIN_IMPORT record linking file
      await createImport.mutateAsync({
        template_id: importTemplate.template_id,
        data: {
          filename: file.name,
          file: fileEntity.file_id,
          import_date: new Date().toISOString(),
          document_type: 'BANK_STATEMENT',
          parser: 'ubs_csv',
          account: effectiveAccountId,
          transactions_created: totalCreated,
          period_from: parsed.header.from,
          period_to: parsed.header.to,
          status: errors.length === 0 ? 'success' : totalCreated > 0 ? 'partial' : 'failed',
        },
      })

      setResult({ created: totalCreated, skipped: skippedCount, errors })

      if (errors.length === 0) {
        setTimeout(onImported, 2000)
      }
    } catch (err) {
      setResult({
        created: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">Import Preview</h3>

      {/* File & header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">File</p>
          <p className="text-sm font-medium truncate">{file.name}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Account IBAN</p>
          <p className="text-sm font-mono">{parsed.header.iban || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Period</p>
          <p className="text-sm">{parsed.header.from} → {parsed.header.to}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Transactions</p>
          <p className="text-sm">{wipTransactions.length} valid, {skippedCount} skipped</p>
        </div>
      </div>

      {/* Account selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">
          Link to Account <span className="text-danger">*</span>
        </label>
        {matchingAccount && !selectedAccountId && (
          <p className="text-xs text-success mb-1">
            Auto-matched by IBAN: {(matchingAccount.data.institution as string)}
          </p>
        )}
        <select
          value={effectiveAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="block w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">Select an account...</option>
          {accounts.map((a) => (
            <option key={a.document_id} value={a.document_id}>
              {a.data.institution as string} — {a.data.iban as string} ({a.data.primary_currency as string})
            </option>
          ))}
        </select>
      </div>

      {/* Transaction preview table */}
      <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Date</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Description</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Counterparty</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Amount</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Type</th>
              </tr>
            </thead>
            <tbody>
              {wipTransactions.slice(0, 20).map((tx, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap">{tx.booking_date as string}</td>
                  <td className="px-3 py-1.5 truncate max-w-48">{tx.description as string}</td>
                  <td className="px-3 py-1.5 truncate max-w-32">{(tx.counterparty_name as string) || '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <span className={(tx.amount as number) >= 0 ? 'text-success font-medium' : ''}>
                      {formatCurrency(tx.amount as number, tx.currency as string)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-text-muted">{tx.transaction_type as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {wipTransactions.length > 20 && (
          <p className="text-xs text-text-muted text-center py-2 bg-gray-50 border-t border-gray-200">
            Showing 20 of {wipTransactions.length} transactions
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={cn(
          'rounded-md p-4 mb-4 text-sm',
          result.errors.length === 0
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger',
        )}>
          <p className="font-medium">
            {result.errors.length === 0
              ? `Successfully imported ${result.created} transactions`
              : `Imported ${result.created} transactions with ${result.errors.length} errors`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 5 && (
                <li>...and {result.errors.length - 5} more errors</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={importing}
          className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={importing || !effectiveAccountId || !txTemplate || !importTemplate || !!result}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {importing ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Importing...
            </>
          ) : (
            <>
              <ArrowRight size={16} />
              Import {wipTransactions.length} Transactions
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export function ImportPage() {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedUbsCsv | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const { data: importData, isLoading } = useDocuments({
    template_value: 'FIN_IMPORT',
    page_size: 50,
  })

  const { data: accountsData } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
  })

  const imports = importData?.items ?? []
  const accounts = accountsData?.items ?? []

  function handleFile(file: File) {
    setSelectedFile(file)
    setParsed(null)
    setParseError(null)

    if (file.name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const result = parseUbsCsv(text)
          setParsed(result)
        } catch (err) {
          setParseError(err instanceof Error ? err.message : 'Failed to parse CSV')
        }
      }
      reader.readAsText(file, 'utf-8')
    } else if (file.name.endsWith('.pdf')) {
      setParseError('PDF import is not yet supported in the browser. Coming soon.')
    } else {
      setParseError(`Unsupported file type: ${file.name.split('.').pop()}`)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [])

  function handleCancel() {
    setSelectedFile(null)
    setParsed(null)
    setParseError(null)
  }

  function handleImported() {
    setSelectedFile(null)
    setParsed(null)
    setParseError(null)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Import</h2>
      </div>

      {/* Preview mode */}
      {parsed && selectedFile && (
        <ImportPreview
          file={selectedFile}
          parsed={parsed}
          accounts={accounts}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )}

      {/* Upload zone — show when no preview */}
      {!parsed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6',
            dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400',
          )}
        >
          {selectedFile && parseError ? (
            <div className="space-y-3">
              <AlertCircle size={32} className="mx-auto text-danger" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-danger">{parseError}</p>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Try another file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={32} className="mx-auto text-text-muted" />
              <div>
                <p className="font-medium">Drop a file here or click to browse</p>
                <p className="text-sm text-text-muted mt-1">
                  Supports UBS CSV bank statements
                </p>
              </div>
              <label className="inline-block px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Import history */}
      <div className="bg-surface border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-lg mb-4">Import History</h3>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!isLoading && imports.length === 0 && (
          <p className="text-text-muted text-sm py-4">No imports yet.</p>
        )}

        {!isLoading && imports.length > 0 && (
          <div>
            {imports.map((doc) => (
              <ImportHistoryItem key={doc.document_id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
