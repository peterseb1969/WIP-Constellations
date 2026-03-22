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
import { isVisecaCsv, parseVisecaCsv, toWipTransaction as visecaToWip } from '@/lib/parsers/viseca-csv'
import { isDkbCsv, parseDkbCsv, toWipTransaction as dkbToWip } from '@/lib/parsers/dkb-csv'
import { extractPdfText } from '@/lib/parsers/pdf-extract'
import {
  parseEmployerPayslip,
  toWipPayslip,
  toWipPayslipLine,
} from '@/lib/parsers/employer-payslip'
import type { ParsedUbsCsv } from '@/lib/parsers/ubs-csv'
import type { ParsedYuhPdf } from '@/lib/parsers/yuh-pdf'
import type { ParsedVisecaCsv } from '@/lib/parsers/viseca-csv'
import type { ParsedDkbCsv } from '@/lib/parsers/dkb-csv'
import type { ParsedEmployerPayslip } from '@/lib/parsers/employer-payslip'

// ---------------------------------------------------------------------------
// Parser detection
// ---------------------------------------------------------------------------

type ParsedResult =
  | { type: 'ubs-csv'; data: ParsedUbsCsv }
  | { type: 'viseca-csv'; data: ParsedVisecaCsv }
  | { type: 'dkb-csv'; data: ParsedDkbCsv }
  | { type: 'yuh-pdf'; data: ParsedYuhPdf }
  | { type: 'employer-payslip'; data: ParsedEmployerPayslip }

function detectParserByFilename(filename: string): 'csv' | 'pdf' | null {
  if (filename.toLowerCase().endsWith('.csv')) return 'csv'
  if (filename.toLowerCase().endsWith('.pdf')) return 'pdf'
  return null
}

/** Detect PDF type by content — looks for signature strings in extracted text */
function detectPdfType(text: string): 'yuh-pdf' | 'employer-payslip' | null {
  if (text.includes('Kontoauszug in') || text.includes('Kontoauszug') && text.includes('Yuh')) return 'yuh-pdf'
  if (text.includes('Employee Nr.') || text.includes('Pay date') || text.includes('Earnings')) return 'employer-payslip'
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
      result.errors.length === 0
        ? 'bg-success/10 text-success'
        : result.created > 0 ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger',
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

/** Hint from a parser about what account to create if none matches */
interface AccountHint {
  iban: string
  institution: string
  accountType: string
  currency: string
  description?: string
}

const CREATE_NEW = '__create_new__'

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CHECKING', label: 'Checking Account' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'SAVINGS', label: 'Savings Account' },
  { value: 'SHARE_DEPOT', label: 'Share Depot' },
  { value: 'EMPLOYER', label: 'Employer' },
]

const inputCls = 'block w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

function AccountSelector({
  accounts,
  selectedId,
  matchedId,
  matchLabel,
  onChange,
  label = 'Link to Account',
  hint,
  onHintChange,
}: {
  accounts: Document[]
  selectedId: string
  matchedId: string
  matchLabel: string
  onChange: (id: string) => void
  label?: string
  hint?: AccountHint
  onHintChange?: (hint: AccountHint) => void
}) {
  const effectiveId = selectedId || matchedId
  const isCreateNew = effectiveId === CREATE_NEW
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-1">
        {label} <span className="text-danger">*</span>
      </label>
      {matchedId && !selectedId && matchedId !== CREATE_NEW && (
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
        {hint && <option value={CREATE_NEW}>+ Create new account</option>}
      </select>
      {isCreateNew && hint && onHintChange && (
        <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-md max-w-md">
          <p className="text-xs font-medium text-primary mb-2">New account details (edit as needed):</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm items-center">
            <label className="text-xs text-text-muted">Institution</label>
            <input
              className={inputCls}
              value={hint.institution}
              onChange={(e) => onHintChange({ ...hint, institution: e.target.value })}
            />
            <label className="text-xs text-text-muted">Type</label>
            <select
              className={inputCls}
              value={hint.accountType}
              onChange={(e) => onHintChange({ ...hint, accountType: e.target.value })}
            >
              {ACCOUNT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="text-xs text-text-muted">IBAN / ID <span className="text-danger">*</span></label>
            <input
              className={cn(inputCls, !hint.iban && 'border-danger/50 bg-danger/5')}
              value={hint.iban}
              placeholder="Required — e.g. CH93 0076 2011 6238 5295 7"
              onChange={(e) => onHintChange({ ...hint, iban: e.target.value })}
            />
            <label className="text-xs text-text-muted">Currency</label>
            <input
              className={inputCls}
              value={hint.currency}
              onChange={(e) => onHintChange({ ...hint, currency: e.target.value })}
            />
            <label className="text-xs text-text-muted">Description</label>
            <input
              className={inputCls}
              value={hint.description ?? ''}
              placeholder="Optional nickname"
              onChange={(e) => onHintChange({ ...hint, description: e.target.value })}
            />
          </div>
          {!hint.iban ? (
            <p className="text-xs text-danger mt-2">IBAN / ID is required to create the account.</p>
          ) : (
            <p className="text-xs text-text-muted mt-2">Account will be created automatically when you hit Import.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transaction import preview (UBS CSV & Yuh PDF)
// ---------------------------------------------------------------------------

interface TransactionPreviewProps {
  file: File
  parserType: 'ubs-csv' | 'yuh-pdf' | 'dkb-csv'
  wipTransactions: Record<string, unknown>[]
  skippedCount: number
  period: { from: string; to: string }
  iban: string
  accounts: Document[]
  accountHint?: AccountHint
  onCancel: () => void
  onImported: () => void
}

const PARSER_LABELS: Record<string, string> = {
  'ubs-csv': 'UBS Bank Statement',
  'yuh-pdf': 'Yuh Account Statement',
  'dkb-csv': 'DKB Bank Statement',
}

const PARSER_CODES: Record<string, string> = {
  'ubs-csv': 'ubs_csv',
  'yuh-pdf': 'yuh_pdf',
  'dkb-csv': 'dkb_csv',
}

function TransactionPreview({
  file, parserType, wipTransactions, skippedCount, period, iban,
  accounts, accountHint: initialHint, onCancel, onImported,
}: TransactionPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [editedHint, setEditedHint] = useState<AccountHint | undefined>(initialHint)

  const { data: txTemplate } = useTemplateByValue('FIN_TRANSACTION')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const { data: accountTemplate } = useTemplateByValue('FIN_ACCOUNT')
  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const createAccount = useCreateDocument()
  const uploadFile = useUploadFile()

  const matchingAccount = accounts.find((a) => {
    const acctIban = (a.data.iban as string)?.replace(/\s/g, '')
    return acctIban === iban.replace(/\s/g, '')
  })
  const effectiveAccountId = selectedAccountId || matchingAccount?.document_id || ''

  async function handleImport() {
    const resolvedId = effectiveAccountId === CREATE_NEW ? null : effectiveAccountId
    if (!txTemplate?.template_id || !importTemplate?.template_id || (!resolvedId && !editedHint)) return
    setImporting(true)
    setResult(null)

    try {
      // 0. Auto-create account if needed
      let accountId = resolvedId
      if (!accountId && editedHint && accountTemplate?.template_id) {
        const acctResult = await createAccount.mutateAsync({
          template_id: accountTemplate.template_id,
          template_version: accountTemplate.version,
          data: {
            iban: editedHint.iban,
            institution: editedHint.institution,
            account_type: editedHint.accountType,
            primary_currency: editedHint.currency,
            description: editedHint.description,
          },
        })
        accountId = acctResult.document_id as string
      }
      if (!accountId) throw new Error('No account selected or created')

      // 1. Create transactions in batches
      const docs: CreateDocumentRequest[] = wipTransactions.map((data) => ({
        template_id: txTemplate.template_id,
        template_version: txTemplate.version,
        data: { ...data, account: accountId },
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
          .forEach((r) => {
            const msg = r.error ?? 'Unknown error'
            // Duplicate version = already imported, count as success
            if (msg.includes('E11000') && msg.includes('version')) {
              totalCreated++
            } else {
              errors.push(msg)
            }
          })
      }

      // 2. Upload original file
      const fileEntity = await uploadFile.mutateAsync({ file, filename: file.name })

      // 3. Create FIN_IMPORT record
      try {
        await createImport.mutateAsync({
          template_id: importTemplate.template_id,
          template_version: importTemplate.version,
          data: {
            filename: file.name,
            file: fileEntity.file_id,
            import_date: new Date().toISOString(),
            document_type: 'BANK_STATEMENT',
            parser: PARSER_CODES[parserType] ?? parserType,
            account: accountId,
            transactions_created: totalCreated,
            period_from: period.from,
            period_to: period.to,
            status: errors.length === 0 ? 'success' : totalCreated > 0 ? 'partial' : 'failed',
          },
        })
      } catch (importErr) {
        errors.push(`Import record: ${importErr instanceof Error ? importErr.message : 'Failed to save import record'}`)
      }

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
        Import Preview — {PARSER_LABELS[parserType] ?? parserType}
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
        hint={editedHint}
        onHintChange={setEditedHint}
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
          disabled={importing || !effectiveAccountId || (effectiveAccountId === CREATE_NEW && !editedHint?.iban) || !txTemplate || !importTemplate || !!result}
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
// Viseca credit card import preview
// ---------------------------------------------------------------------------

interface VisecaPreviewProps {
  file: File
  parsed: ParsedVisecaCsv
  wipTransactions: Record<string, unknown>[]
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

function VisecaPreview({
  file, parsed, wipTransactions, accounts, onCancel, onImported,
}: VisecaPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [editedHint, setEditedHint] = useState<AccountHint>({
    iban: `VISECA-${parsed.cardId}`,
    institution: 'Viseca',
    accountType: 'CREDIT_CARD',
    currency: parsed.currency,
    description: `Credit Card ${parsed.cardId}`,
  })

  const { data: txTemplate } = useTemplateByValue('FIN_TRANSACTION')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const { data: accountTemplate } = useTemplateByValue('FIN_ACCOUNT')
  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const createAccount = useCreateDocument()
  const uploadFile = useUploadFile()

  // Match by CardId in the synthetic IBAN (VISECA-{CardId} pattern)
  const matchingAccount = accounts.find((a) => {
    const acctIban = a.data.iban as string
    return acctIban === `VISECA-${parsed.cardId}`
  })
  const effectiveAccountId = selectedAccountId || matchingAccount?.document_id || ''

  async function handleImport() {
    const resolvedId = effectiveAccountId === CREATE_NEW ? null : effectiveAccountId
    if (!txTemplate?.template_id || !importTemplate?.template_id || (!resolvedId && !editedHint)) return
    setImporting(true)
    setResult(null)

    try {
      // 0. Auto-create account if needed
      let accountId = resolvedId
      if (!accountId && accountTemplate?.template_id) {
        const acctResult = await createAccount.mutateAsync({
          template_id: accountTemplate.template_id,
          template_version: accountTemplate.version,
          data: {
            iban: editedHint.iban,
            institution: editedHint.institution,
            account_type: editedHint.accountType,
            primary_currency: editedHint.currency,
            description: editedHint.description,
          },
        })
        accountId = acctResult.document_id as string
      }
      if (!accountId) throw new Error('No account selected or created')

      const docs: CreateDocumentRequest[] = wipTransactions.map((data) => ({
        template_id: txTemplate.template_id,
        template_version: txTemplate.version,
        data: { ...data, account: accountId },
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
          .forEach((r) => {
            const msg = r.error ?? 'Unknown error'
            if (msg.includes('E11000') && msg.includes('version')) {
              totalCreated++
            } else {
              errors.push(msg)
            }
          })
      }

      const fileEntity = await uploadFile.mutateAsync({ file, filename: file.name })

      try {
        await createImport.mutateAsync({
          template_id: importTemplate.template_id,
          template_version: importTemplate.version,
          data: {
            filename: file.name,
            file: fileEntity.file_id,
            import_date: new Date().toISOString(),
            document_type: 'CREDIT_CARD_STATEMENT',
            parser: 'viseca_csv',
            account: accountId,
            transactions_created: totalCreated,
            period_from: parsed.period.from,
            period_to: parsed.period.to,
            status: errors.length === 0 ? 'success' : totalCreated > 0 ? 'partial' : 'failed',
          },
        })
      } catch (importErr) {
        errors.push(`Import record: ${importErr instanceof Error ? importErr.message : 'Failed to save import record'}`)
      }

      setResult({ created: totalCreated, skipped: 0, errors })
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
        Import Preview — Viseca Credit Card Statement
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">File</p>
          <p className="text-sm font-medium truncate">{file.name}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Card ID</p>
          <p className="text-sm font-mono">{parsed.cardId || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Period</p>
          <p className="text-sm">{parsed.period.from} → {parsed.period.to}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Transactions</p>
          <p className="text-sm">{wipTransactions.length} total</p>
        </div>
      </div>

      <AccountSelector
        accounts={accounts}
        selectedId={selectedAccountId}
        matchedId={matchingAccount?.document_id ?? ''}
        matchLabel={matchingAccount ? `${matchingAccount.data.institution as string} (Credit Card)` : ''}
        onChange={setSelectedAccountId}
        label="Link to Credit Card Account"
        hint={editedHint}
        onHintChange={setEditedHint}
      />

      <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Date</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Merchant</th>
                <th className="text-left px-3 py-2 font-medium text-text-muted">Location</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Amount</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted">Original</th>
              </tr>
            </thead>
            <tbody>
              {wipTransactions.slice(0, 20).map((tx, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap">{tx.booking_date as string}</td>
                  <td className="px-3 py-1.5 truncate max-w-48">{tx.counterparty_name as string}</td>
                  <td className="px-3 py-1.5 truncate max-w-32">
                    {[tx.merchant_city, tx.merchant_country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {formatCurrency(tx.amount as number, tx.currency as string)}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-text-muted">
                    {tx.original_currency && tx.original_currency !== tx.currency
                      ? formatCurrency(tx.original_amount as number, tx.original_currency as string)
                      : '—'}
                  </td>
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
          disabled={importing || !effectiveAccountId || (effectiveAccountId === CREATE_NEW && !editedHint?.iban) || !txTemplate || !importTemplate || !!result}
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
              Import {wipTransactions.length} Credit Card Transactions
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payslip import preview (employer)
// ---------------------------------------------------------------------------

interface PayslipPreviewProps {
  file: File
  parsed: ParsedEmployerPayslip
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

function PayslipPreview({ file, parsed, accounts, onCancel, onImported }: PayslipPreviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const employerName = parsed.header.company || 'Employer'
  const [editedHint, setEditedHint] = useState<AccountHint>({
    iban: `EMPLOYER-${employerName.toUpperCase().replace(/\s+/g, '-')}`,
    institution: employerName,
    accountType: 'EMPLOYER',
    currency: parsed.summary.currency || 'CHF',
    description: `Payslip source — ${employerName}`,
  })

  const { data: payslipTemplate } = useTemplateByValue('FIN_PAYSLIP')
  const { data: lineTemplate } = useTemplateByValue('FIN_PAYSLIP_LINE')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const { data: accountTemplate } = useTemplateByValue('FIN_ACCOUNT')
  const createDoc = useCreateDocument()
  const createDocs = useCreateDocuments()
  const createImport = useCreateDocument()
  const createAccountDoc = useCreateDocument()
  const uploadFile = useUploadFile()

  // Match employer account by type
  const matchingEmployer = accounts.find((a) => {
    const type = a.data.account_type as string
    return type === 'EMPLOYER'
  })
  const effectiveAccountId = selectedAccountId || matchingEmployer?.document_id || ''

  // Filter to employer accounts
  const employerAccounts = accounts.filter((a) => a.data.account_type === 'EMPLOYER')

  async function handleImport() {
    const resolvedId = effectiveAccountId === CREATE_NEW ? null : effectiveAccountId
    if (!payslipTemplate?.template_id || !lineTemplate?.template_id || !importTemplate?.template_id || (!resolvedId && !editedHint)) return
    setImporting(true)
    setResult(null)

    try {
      // 0. Auto-create account if needed
      let accountId = resolvedId
      if (!accountId && accountTemplate?.template_id) {
        const acctResult = await createAccountDoc.mutateAsync({
          template_id: accountTemplate.template_id,
          template_version: accountTemplate.version,
          data: {
            iban: editedHint.iban,
            institution: editedHint.institution,
            account_type: editedHint.accountType,
            primary_currency: editedHint.currency,
            description: editedHint.description,
          },
        })
        accountId = acctResult.document_id as string
      }
      if (!accountId) throw new Error('No account selected or created')

      // 1. Create payslip document
      const payslipData = toWipPayslip(parsed, accountId)
      const payslipResult = await createDoc.mutateAsync({
        template_id: payslipTemplate.template_id,
        template_version: payslipTemplate.version,
        data: payslipData,
      })
      const payslipDocId = payslipResult.document_id as string

      // 2. Create line items
      const lineDocs: CreateDocumentRequest[] = parsed.lines.map((line) => ({
        template_id: lineTemplate.template_id,
        template_version: lineTemplate.version,
        data: toWipPayslipLine(line, payslipDocId),
      }))

      let linesCreated = 0
      const errors: string[] = []

      if (lineDocs.length > 0) {
        const res = await createDocs.mutateAsync(lineDocs)
        linesCreated = res.results.filter((r) => r.status === 'created' || r.status === 'updated').length
        res.results
          .filter((r) => r.status === 'error')
          .forEach((r) => {
            const msg = r.error ?? 'Unknown error'
            // Duplicate version = already imported, count as success
            if (msg.includes('E11000') && msg.includes('version')) {
              linesCreated++
            } else {
              errors.push(msg)
            }
          })
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
          parser: 'employer_payslip',
          account: accountId,
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
      <h3 className="font-semibold text-lg mb-4">Import Preview — Employer Payslip</h3>

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
        hint={editedHint}
        onHintChange={setEditedHint}
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
          disabled={importing || !effectiveAccountId || (effectiveAccountId === CREATE_NEW && !editedHint?.iban) || !payslipTemplate || !lineTemplate || !importTemplate || !!result}
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

    if (fileType === 'csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          if (isVisecaCsv(text)) {
            const result = parseVisecaCsv(text)
            setParsed({ type: 'viseca-csv', data: result })
          } else if (isDkbCsv(text)) {
            const result = parseDkbCsv(text)
            setParsed({ type: 'dkb-csv', data: result })
          } else {
            const result = parseUbsCsv(text)
            setParsed({ type: 'ubs-csv', data: result })
          }
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
          const original = e.target?.result as ArrayBuffer
          // Clone buffer — pdfjs-dist detaches it on first use
          const { text } = await extractPdfText(original.slice(0))
          const pdfType = detectPdfType(text)
          if (!pdfType) {
            setParseError('Could not identify this PDF. Expected a Yuh bank statement or employer payslip.')
            return
          }
          if (pdfType === 'yuh-pdf') {
            const result = await parseYuhPdf(original.slice(0))
            setParsed({ type: 'yuh-pdf', data: result })
          } else {
            const result = await parseEmployerPayslip(original.slice(0))
            setParsed({ type: 'employer-payslip', data: result })
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
          accountHint={{
            iban: p.header.iban,
            institution: 'UBS',
            accountType: 'CHECKING',
            currency: p.header.currency || 'CHF',
            description: `UBS Account ${p.header.accountNumber}`,
          }}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    if (parsed.type === 'dkb-csv') {
      const p = parsed.data
      const wipTxs = p.transactions
        .map((tx, i) => dkbToWip(tx, '', i))
        .filter((t): t is Record<string, unknown> => t !== null)
      const skipped = p.transactions.length - wipTxs.length
      const dates = wipTxs.map((t) => t.booking_date as string).filter(Boolean).sort()

      return (
        <TransactionPreview
          file={selectedFile}
          parserType="dkb-csv"
          wipTransactions={wipTxs}
          skippedCount={skipped}
          period={{ from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' }}
          iban={p.header.iban}
          accounts={accounts}
          accountHint={{
            iban: p.header.iban,
            institution: 'DKB',
            accountType: 'CHECKING',
            currency: 'EUR',
            description: `DKB ${p.header.accountType}`,
          }}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    if (parsed.type === 'viseca-csv') {
      const p = parsed.data
      const wipTxs = p.transactions.map((tx) => visecaToWip(tx, ''))

      return (
        <VisecaPreview
          file={selectedFile}
          parsed={p}
          wipTransactions={wipTxs}
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
          accountHint={{
            iban: p.header.iban,
            institution: 'Yuh',
            accountType: 'CHECKING',
            currency: p.header.currency || 'CHF',
          }}
          onCancel={handleCancel}
          onImported={handleImported}
        />
      )
    }

    if (parsed.type === 'employer-payslip') {
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
                  Supports UBS CSV, DKB CSV, Viseca credit card CSV, Yuh PDF, employer payslip PDFs
                </p>
              </div>
              <label className="inline-block px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept=".csv,.pdf"
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
