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
import { parseUbsCsv, toWipTransaction as ubsToWip } from '@/lib/parsers/ubs-csv'
import { parseYuhPdf, toWipTransaction as yuhToWip } from '@/lib/parsers/yuh-pdf'
import { extractPdfText } from '@/lib/parsers/pdf-extract'
import {
  parseRochePayslip,
  toWipPayslip,
  toWipPayslipLine,
} from '@/lib/parsers/roche-payslip'
import type { ParsedUbsCsv } from '@/lib/parsers/ubs-csv'
import type { ParsedYuhPdf } from '@/lib/parsers/yuh-pdf'
import type { ParsedRochePayslip } from '@/lib/parsers/roche-payslip'

// ---------------------------------------------------------------------------
// Parser detection
// ---------------------------------------------------------------------------

type ParsedResult =
  | { type: 'ubs-csv'; data: ParsedUbsCsv }
  | { type: 'yuh-pdf'; data: ParsedYuhPdf }
  | { type: 'roche-payslip'; data: ParsedRochePayslip }

function detectParserByFilename(filename: string): 'ubs-csv' | 'pdf' | null {
  if (filename.toLowerCase().endsWith('.csv')) return 'ubs-csv'
  if (filename.toLowerCase().endsWith('.pdf')) return 'pdf'
  return null
}

/** Detect PDF type by content — looks for signature strings in extracted text */
function detectPdfType(text: string): 'yuh-pdf' | 'roche-payslip' | null {
  if (text.includes('Kontoauszug in') || text.includes('Kontoauszug') && text.includes('Yuh')) return 'yuh-pdf'
  if (text.includes('Employee Nr.') || text.includes('Pay date') || text.includes('Earnings')) return 'roche-payslip'
  return null
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

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
          <span>{d.transactions_created as number} items</span>
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

function ImportResult({ result }: { result: { created: number; skipped: number; errors: string[] } }) {
  return (
    <div className={cn(
      'rounded-md p-4 mb-4 text-sm',
      result.errors.length === 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
    )}>
      <p className="font-medium">
        {result.errors.length === 0
          ? `Successfully imported ${result.created} items`
          : `Imported ${result.created} items with ${result.errors.length} errors`}
      </p>
      {result.errors.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
          {result.errors.length > 5 && <li>...and {result.errors.length - 5} more errors</li>}
        </ul>
      )}
    </div>
  )
}

function AccountSelector({
  accounts,
  selectedId,
  matchedId,
  matchLabel,
  onChange,
  label = 'Link to Account',
}: {
  accounts: Document[]
  selectedId: string
  matchedId: string
  matchLabel: string
  onChange: (id: string) => void
  label?: string
}) {
  const effectiveId = selectedId || matchedId
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-1">
        {label} <span className="text-danger">*</span>
      </label>
      {matchedId && !selectedId && (
        <p className="text-xs text-success mb-1">Auto-matched: {matchLabel}</p>
      )}
      <select
        value={effectiveId}
        onChange={(e) => onChange(e.target.value)}
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
  )
}

// ---------------------------------------------------------------------------
// Transaction import preview (UBS CSV & Yuh PDF)
// ---------------------------------------------------------------------------

interface TransactionPreviewProps {
  file: File
  parserType: 'ubs-csv' | 'yuh-pdf'
  wipTransactions: Record<string, unknown>[]
  skippedCount: number
  period: { from: string; to: string }
  iban: string
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

function TransactionPreview({
  file, parserType, wipTransactions, skippedCount, period, iban,
  accounts, onCancel, onImported,
}: TransactionPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const { data: txTemplate } = useTemplateByValue('FIN_TRANSACTION')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const uploadFile = useUploadFile()

  const matchingAccount = accounts.find((a) => {
    const acctIban = (a.data.iban as string)?.replace(/\s/g, '')
    return acctIban === iban.replace(/\s/g, '')
  })
  const effectiveAccountId = selectedAccountId || matchingAccount?.document_id || ''

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

      // 2. Upload original file
      const fileEntity = await uploadFile.mutateAsync({ file, filename: file.name })

      // 3. Create FIN_IMPORT record
      await createImport.mutateAsync({
        template_id: importTemplate.template_id,
        data: {
          filename: file.name,
          file: fileEntity.file_id,
          import_date: new Date().toISOString(),
          document_type: 'BANK_STATEMENT',
          parser: parserType === 'ubs-csv' ? 'ubs_csv' : 'yuh_pdf',
          account: effectiveAccountId,
          transactions_created: totalCreated,
          period_from: period.from,
          period_to: period.to,
          status: errors.length === 0 ? 'success' : totalCreated > 0 ? 'partial' : 'failed',
        },
      })

      setResult({ created: totalCreated, skipped: skippedCount, errors })
      if (errors.length === 0) setTimeout(onImported, 2000)
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">
        Import Preview — {parserType === 'ubs-csv' ? 'UBS Bank Statement' : 'Yuh Account Statement'}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">File</p>
          <p className="text-sm font-medium truncate">{file.name}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Account IBAN</p>
          <p className="text-sm font-mono">{iban || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Period</p>
          <p className="text-sm">{period.from} → {period.to}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Transactions</p>
          <p className="text-sm">{wipTransactions.length} valid{skippedCount > 0 ? `, ${skippedCount} skipped` : ''}</p>
        </div>
      </div>

      <AccountSelector
        accounts={accounts}
        selectedId={selectedAccountId}
        matchedId={matchingAccount?.document_id ?? ''}
        matchLabel={matchingAccount?.data.institution as string ?? ''}
        onChange={setSelectedAccountId}
      />

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

      {result && <ImportResult result={result} />}

      <div className="flex items-center justify-end gap-3">
        <button onClick={onCancel} disabled={importing} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
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

// ---------------------------------------------------------------------------
// Payslip import preview (Roche)
// ---------------------------------------------------------------------------

interface PayslipPreviewProps {
  file: File
  parsed: ParsedRochePayslip
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

function PayslipPreview({ file, parsed, accounts, onCancel, onImported }: PayslipPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const { data: payslipTemplate } = useTemplateByValue('FIN_PAYSLIP')
  const { data: lineTemplate } = useTemplateByValue('FIN_PAYSLIP_LINE')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const createDoc = useCreateDocument()
  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const uploadFile = useUploadFile()

  // Match employer by name containing "Roche" or "Hoffmann"
  const matchingEmployer = accounts.find((a) => {
    const type = a.data.account_type as string
    const name = (a.data.institution as string)?.toLowerCase() ?? ''
    return type === 'EMPLOYER' && (name.includes('roche') || name.includes('hoffmann'))
  })
  const effectiveAccountId = selectedAccountId || matchingEmployer?.document_id || ''

  // Filter to employer accounts
  const employerAccounts = accounts.filter((a) => a.data.account_type === 'EMPLOYER')

  async function handleImport() {
    if (!payslipTemplate?.template_id || !lineTemplate?.template_id || !importTemplate?.template_id || !effectiveAccountId) return
    setImporting(true)
    setResult(null)

    try {
      // 1. Create payslip document
      const payslipData = toWipPayslip(parsed, effectiveAccountId)
      const payslipResult = await createDoc.mutateAsync({
        template_id: payslipTemplate.template_id,
        data: payslipData,
      })
      const payslipDocId = payslipResult.document_id as string

      // 2. Create line items
      const lineDocs: CreateDocumentRequest[] = parsed.lines.map((line) => ({
        template_id: lineTemplate.template_id,
        data: toWipPayslipLine(line, payslipDocId),
      }))

      let linesCreated = 0
      const errors: string[] = []

      if (lineDocs.length > 0) {
        const res = await createDocs.mutateAsync(lineDocs)
        linesCreated = res.results.filter((r) => r.status === 'created' || r.status === 'updated').length
        res.results
          .filter((r) => r.status === 'error')
          .forEach((r) => errors.push(r.error ?? 'Unknown error'))
      }

      // 3. Upload original file
      const fileEntity = await uploadFile.mutateAsync({ file, filename: file.name })

      // 4. Create FIN_IMPORT record
      await createImport.mutateAsync({
        template_id: importTemplate.template_id,
        data: {
          filename: file.name,
          file: fileEntity.file_id,
          import_date: new Date().toISOString(),
          document_type: 'PAYSLIP',
          parser: 'roche_payslip',
          account: effectiveAccountId,
          transactions_created: linesCreated + 1, // payslip + lines
          period_from: parsed.header.payDate,
          period_to: parsed.header.payDate,
          status: errors.length === 0 ? 'success' : linesCreated > 0 ? 'partial' : 'failed',
        },
      })

      setResult({ created: linesCreated + 1, skipped: 0, errors })
      if (errors.length === 0) setTimeout(onImported, 2000)
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">Import Preview — Roche Payslip</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">Period</p>
          <p className="text-sm font-medium">{parsed.header.periodLabel}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Pay Date</p>
          <p className="text-sm">{parsed.header.payDate}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Employee</p>
          <p className="text-sm">{parsed.header.employeeName} #{parsed.header.employeeNumber}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Capacity</p>
          <p className="text-sm">{parsed.header.capacityPercent}%</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Gross', value: parsed.summary.gross },
          { label: 'Net', value: parsed.summary.net },
          { label: 'Payment', value: parsed.summary.paymentAmount },
          { label: 'Social', value: parsed.summary.totalSocialContributions },
          { label: 'Pension', value: parsed.summary.totalPensionContributions },
          { label: 'Deductions', value: parsed.summary.totalDeductions },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-md p-2.5">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-sm font-medium">{formatCurrency(value, parsed.summary.currency)}</p>
          </div>
        ))}
      </div>

      <AccountSelector
        accounts={employerAccounts.length > 0 ? employerAccounts : accounts}
        selectedId={selectedAccountId}
        matchedId={matchingEmployer?.document_id ?? ''}
        matchLabel={matchingEmployer?.data.institution as string ?? ''}
        onChange={setSelectedAccountId}
        label="Employer Account"
      />

      {/* Line items */}
      <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Code</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Description</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Category</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Basis</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Rate</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {parsed.lines.map((line, i) => (
                <tr key={i} className={cn('border-t border-gray-100', line.isDeduction && 'text-text-muted')}>
                  <td className="px-3 py-1.5 font-mono text-xs">{line.code}</td>
                  <td className="px-3 py-1.5">{line.description}</td>
                  <td className="px-3 py-1.5 text-xs">{line.category}</td>
                  <td className="px-3 py-1.5 text-right">{line.basis ? formatCurrency(line.basis, 'CHF') : ''}</td>
                  <td className="px-3 py-1.5 text-right">{line.rate ? `${line.rate}%` : ''}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <span className={line.isDeduction ? 'text-danger' : ''}>
                      {line.isDeduction ? '-' : ''}{formatCurrency(line.amount, parsed.summary.currency)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result && <ImportResult result={result} />}

      <div className="flex items-center justify-end gap-3">
        <button onClick={onCancel} disabled={importing} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={importing || !effectiveAccountId || !payslipTemplate || !lineTemplate || !importTemplate || !!result}
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
              Import Payslip ({parsed.lines.length} line items)
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ImportPage
// ---------------------------------------------------------------------------

export function ImportPage() {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  const { data: importData, isLoading } = useDocuments({
    template_value: 'FIN_IMPORT',
    page_size: 50,
    latest_only: true,
  })

  const { data: accountsData } = useDocuments({
    template_value: 'FIN_ACCOUNT',
    page_size: 50,
    latest_only: true,
  })

  const imports = importData?.items ?? []
  const accounts = accountsData?.items ?? []

  function handleFile(file: File) {
    setSelectedFile(file)
    setParsed(null)
    setParseError(null)

    const fileType = detectParserByFilename(file.name)
    if (!fileType) {
      setParseError(`Unsupported file type: ${file.name}. Expected a .csv or .pdf file.`)
      return
    }

    if (fileType === 'ubs-csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const result = parseUbsCsv(text)
          setParsed({ type: 'ubs-csv', data: result })
        } catch (err) {
          setParseError(err instanceof Error ? err.message : 'Failed to parse CSV')
        }
      }
      reader.readAsText(file, 'utf-8')
    } else {
      // PDF — detect type by content
      setParsing(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const { text } = await extractPdfText(buffer)
          const pdfType = detectPdfType(text)
          if (!pdfType) {
            setParseError('Could not identify this PDF. Expected a Yuh bank statement or Roche payslip.')
            return
          }
          if (pdfType === 'yuh-pdf') {
            const result = await parseYuhPdf(buffer)
            setParsed({ type: 'yuh-pdf', data: result })
          } else {
            const result = await parseRochePayslip(buffer)
            setParsed({ type: 'roche-payslip', data: result })
          }
        } catch (err) {
          setParseError(err instanceof Error ? err.message : 'Failed to parse PDF')
        } finally {
          setParsing(false)
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Build preview based on parsed type
  function renderPreview() {
    if (!parsed || !selectedFile) return null

    if (parsed.type === 'ubs-csv') {
      const p = parsed.data
      const wipTxs = p.transactions
        .map((tx) => ubsToWip(tx, ''))
        .filter((t): t is Record<string, unknown> => t !== null)
      const skipped = p.transactions.length - wipTxs.length

      return (
        <TransactionPreview
          file={selectedFile}
          parserType="ubs-csv"
          wipTransactions={wipTxs}
          skippedCount={skipped}
          period={{ from: p.header.from, to: p.header.to }}
          iban={p.header.iban}
          accounts={accounts}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    if (parsed.type === 'yuh-pdf') {
      const p = parsed.data
      const wipTxs = p.transactions.map((tx) => yuhToWip(tx, ''))

      return (
        <TransactionPreview
          file={selectedFile}
          parserType="yuh-pdf"
          wipTransactions={wipTxs}
          skippedCount={0}
          period={{ from: p.header.periodFrom, to: p.header.periodTo }}
          iban={p.header.iban}
          accounts={accounts}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    if (parsed.type === 'roche-payslip') {
      return (
        <PayslipPreview
          file={selectedFile}
          parsed={parsed.data}
          accounts={accounts}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    return null
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Import</h2>
      </div>

      {/* Preview mode */}
      {renderPreview()}

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
          {parsing ? (
            <div className="space-y-3">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="font-medium">Parsing {selectedFile?.name}...</p>
            </div>
          ) : selectedFile && parseError ? (
            <div className="space-y-3">
              <AlertCircle size={32} className="mx-auto text-danger" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-danger">{parseError}</p>
              <button onClick={handleCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                Try another file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={32} className="mx-auto text-text-muted" />
              <div>
                <p className="font-medium">Drop a file here or click to browse</p>
                <p className="text-sm text-text-muted mt-1">
                  Supports UBS CSV, Yuh PDF statements, Roche payslip PDFs
                </p>
              </div>
              <label className="inline-block px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept=".csv,.pdf,.PDF"
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
