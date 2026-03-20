import { useState, useMemo } from 'react'
import { Plus, Trash2, ArrowRight, AlertTriangle } from 'lucide-react'
import {
  useCreateDocument,
  useCreateDocuments,
  useUploadFile,
  useTemplateByValue,
  useDocuments,
} from '@wip/react'
import type { Document, CreateDocumentRequest } from '@wip/client'
import { cn, formatCurrency } from '@/lib/utils'
import type { ExtractedReceipt, ExtractedReceiptLine } from '@/lib/parsers/receipt-scan'
import { toWipTransactionLine } from '@/lib/parsers/receipt-scan'

// ---------------------------------------------------------------------------
// Editable line item row
// ---------------------------------------------------------------------------

interface LineRowProps {
  line: ExtractedReceiptLine
  index: number
  currency: string
  categories: { value: string; label: string }[]
  selectedCategory: string
  onUpdate: (index: number, line: ExtractedReceiptLine) => void
  onCategoryChange: (index: number, value: string) => void
  onDelete: (index: number) => void
}

function LineRow({ line, index, currency, categories, selectedCategory, onUpdate, onCategoryChange, onDelete }: LineRowProps) {
  return (
    <tr className="border-t border-gray-100 group">
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={line.description}
          onChange={(e) => onUpdate(index, { ...line, description: e.target.value })}
          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none text-sm px-1 py-0.5"
        />
      </td>
      <td className="px-2 py-1.5 w-16">
        <input
          type="number"
          value={line.quantity ?? ''}
          onChange={(e) => onUpdate(index, { ...line, quantity: e.target.value ? Number(e.target.value) : null })}
          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none text-sm text-right px-1 py-0.5"
          step="1"
          min="1"
        />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input
          type="number"
          value={line.unitPrice ?? ''}
          onChange={(e) => onUpdate(index, { ...line, unitPrice: e.target.value ? Number(e.target.value) : null })}
          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none text-sm text-right px-1 py-0.5"
          step="0.05"
        />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input
          type="number"
          value={line.total}
          onChange={(e) => onUpdate(index, { ...line, total: Number(e.target.value) || 0 })}
          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none text-sm text-right font-medium px-1 py-0.5"
          step="0.05"
        />
      </td>
      <td className="px-2 py-1.5 w-36">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(index, e.target.value)}
          className="w-full bg-transparent text-sm border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none px-1 py-0.5"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1.5 w-8">
        <button
          onClick={() => onDelete(index)}
          className="text-gray-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove line"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ReceiptScanPreviewProps {
  file: File
  extracted: ExtractedReceipt
  accounts: Document[]
  onCancel: () => void
  onImported: () => void
}

export function ReceiptScanPreview({ file, extracted, accounts, onCancel, onImported }: ReceiptScanPreviewProps) {
  // Editable state — initialised from extraction
  const [merchant, setMerchant] = useState(extracted.merchant)
  const [receiptDate, setReceiptDate] = useState(extracted.date)
  const [currency, setCurrency] = useState(extracted.currency)
  const [total, setTotal] = useState(extracted.total ?? 0)
  const [paymentMethod, setPaymentMethod] = useState(extracted.paymentMethod)
  const [lines, setLines] = useState<ExtractedReceiptLine[]>(extracted.lines)
  const [lineCategories, setLineCategories] = useState<Record<number, string>>({})
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [matchTransactionId, setMatchTransactionId] = useState('')

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null)

  const { data: txTemplate } = useTemplateByValue('FIN_TRANSACTION')
  const { data: lineTemplate } = useTemplateByValue('FIN_TRANSACTION_LINE')
  const { data: importTemplate } = useTemplateByValue('FIN_IMPORT')
  const createDoc = useCreateDocument()
  const createDocs = useCreateDocuments()
  const uploadFile = useUploadFile()

  // Load existing transactions for matching
  const { data: txData } = useDocuments({
    template_value: 'FIN_TRANSACTION',
    page_size: 100,
    latest_only: true,
  })
  const transactions = txData?.items ?? []

  // Categories from terminology
  const { data: catData } = useDocuments({
    template_value: 'FIN_TRANSACTION_CATEGORY',
    page_size: 50,
  })
  // Build categories list from the terminology terms via a simpler approach
  const categories = useMemo(() => [
    { value: 'GROCERIES', label: 'Groceries' },
    { value: 'DINING', label: 'Dining' },
    { value: 'TRANSPORT', label: 'Transport' },
    { value: 'HOUSING', label: 'Housing' },
    { value: 'UTILITIES', label: 'Utilities' },
    { value: 'INSURANCE', label: 'Insurance' },
    { value: 'HEALTHCARE', label: 'Healthcare' },
    { value: 'ENTERTAINMENT', label: 'Entertainment' },
    { value: 'SHOPPING', label: 'Shopping' },
    { value: 'INCOME', label: 'Income' },
    { value: 'OTHER', label: 'Other' },
  ], [catData])

  // Merchant suggestions from existing transactions
  const merchantSuggestions = useMemo(() => {
    const names = new Set<string>()
    for (const tx of transactions) {
      const name = tx.data.counterparty_name as string
      if (name) names.add(name)
    }
    return Array.from(names).sort()
  }, [transactions])

  // Candidate transactions for matching (same date ± 3 days, similar amount)
  const matchCandidates = useMemo(() => {
    if (!receiptDate || !total) return []
    const d = new Date(receiptDate)
    return transactions.filter((tx) => {
      const txDate = new Date(tx.data.booking_date as string)
      const daysDiff = Math.abs((txDate.getTime() - d.getTime()) / 86400000)
      const amtMatch = Math.abs(Math.abs(tx.data.amount as number) - total) < 0.1
      return daysDiff <= 3 && amtMatch
    })
  }, [transactions, receiptDate, total])

  // Line item calculations
  const linesTotal = useMemo(() => lines.reduce((sum, l) => sum + l.total, 0), [lines])
  const totalMismatch = total > 0 && Math.abs(linesTotal - total) > 0.01

  function updateLine(index: number, updated: ExtractedReceiptLine) {
    setLines((prev) => prev.map((l, i) => (i === index ? updated : l)))
  }

  function deleteLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
    setLineCategories((prev) => {
      const next = { ...prev }
      delete next[index]
      // Re-index categories above the deleted line
      const reindexed: Record<number, string> = {}
      for (const [k, v] of Object.entries(next)) {
        const ki = Number(k)
        reindexed[ki > index ? ki - 1 : ki] = v
      }
      return reindexed
    })
  }

  function addLine() {
    setLines((prev) => [...prev, { description: '', quantity: null, unitPrice: null, total: 0 }])
  }

  function clearAll() {
    setLines([])
    setLineCategories({})
  }

  function updateCategory(index: number, value: string) {
    setLineCategories((prev) => ({ ...prev, [index]: value }))
  }

  async function handleImport() {
    if (!lineTemplate?.template_id || !importTemplate?.template_id) return
    if (!receiptDate || !merchant) return
    setImporting(true)
    setResult(null)

    try {
      let transactionDocId = matchTransactionId

      // If no matched transaction, create one
      if (!transactionDocId && txTemplate?.template_id && selectedAccountId) {
        const txResult = await createDoc.mutateAsync({
          template_id: txTemplate.template_id,
          data: {
            account: selectedAccountId,
            source_reference: `RECEIPT-${Date.now()}`,
            booking_date: receiptDate,
            currency,
            amount: -total,
            description: merchant,
            counterparty_name: merchant,
            transaction_type: paymentMethod === 'BAR' ? 'OTHER' : 'DEBIT_CARD',
          },
        })
        transactionDocId = txResult.document_id as string
      }

      if (!transactionDocId) {
        setResult({ created: 0, errors: ['No transaction selected or created. Select an account or match to an existing transaction.'] })
        return
      }

      // Create line items
      const lineDocs: CreateDocumentRequest[] = lines
        .filter((l) => l.description && l.total)
        .map((line, i) => {
          const data = toWipTransactionLine(line, transactionDocId)
          const cat = lineCategories[i]
          if (cat) data.category = cat
          return {
            template_id: lineTemplate.template_id,
            data,
          }
        })

      let linesCreated = 0
      const errors: string[] = []

      if (lineDocs.length > 0) {
        const res = await createDocs.mutateAsync(lineDocs)
        linesCreated = res.results.filter((r) => r.status === 'created' || r.status === 'updated').length
        res.results
          .filter((r) => r.status === 'error')
          .forEach((r) => {
            const msg = r.error ?? 'Unknown error'
            if (msg.includes('E11000') && msg.includes('version')) {
              linesCreated++
            } else {
              errors.push(msg)
            }
          })
      }

      // Upload original scan
      const fileEntity = await uploadFile.mutateAsync({ file, filename: file.name })

      // Create FIN_IMPORT record
      await createDoc.mutateAsync({
        template_id: importTemplate.template_id,
        data: {
          filename: file.name,
          file: fileEntity.file_id,
          import_date: new Date().toISOString(),
          document_type: 'BANK_STATEMENT',
          parser: 'receipt_scan',
          account: selectedAccountId || undefined,
          transactions_created: linesCreated,
          period_from: receiptDate,
          period_to: receiptDate,
          status: errors.length === 0 ? 'success' : linesCreated > 0 ? 'partial' : 'failed',
        },
      })

      setResult({ created: linesCreated, errors })
      if (errors.length === 0) setTimeout(onImported, 2000)
    } catch (err) {
      setResult({ created: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-surface border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Receipt Scan — Edit &amp; Import</h3>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded',
          extracted.confidence > 70 ? 'bg-success/10 text-success' : extracted.confidence > 40 ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger',
        )}>
          OCR confidence: {Math.round(extracted.confidence)}%
        </span>
      </div>

      {/* Two-column: form left, raw OCR right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: editable fields */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-text-muted">Extracted Fields (edit as needed)</h4>

          {/* Merchant with autocomplete */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Merchant</label>
            <input
              type="text"
              list="merchant-suggestions"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Store name"
            />
            <datalist id="merchant-suggestions">
              {merchantSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Date</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Total</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value) || 0)}
                className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                step="0.05"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full max-w-48 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Unknown</option>
              <option value="BAR">Cash</option>
              <option value="KARTE">Card</option>
              <option value="MAESTRO">Maestro</option>
              <option value="VISA">Visa</option>
              <option value="MASTERCARD">Mastercard</option>
              <option value="TWINT">TWINT</option>
            </select>
          </div>

          {/* Transaction matching */}
          {matchCandidates.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
              <label className="block text-xs font-medium text-primary mb-1">Match to existing transaction</label>
              <select
                value={matchTransactionId}
                onChange={(e) => setMatchTransactionId(e.target.value)}
                className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Create new transaction</option>
                {matchCandidates.map((tx) => (
                  <option key={tx.document_id} value={tx.document_id}>
                    {tx.data.booking_date as string} — {tx.data.counterparty_name as string || tx.data.description as string} — {formatCurrency(tx.data.amount as number, currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account selector (only if creating new transaction) */}
          {!matchTransactionId && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Account (for new transaction)</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.document_id} value={a.document_id}>
                    {a.data.institution as string} — {a.data.iban as string}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: raw OCR text */}
        <div>
          <h4 className="text-sm font-medium text-text-muted mb-1">Raw OCR Text (reference)</h4>
          <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono whitespace-pre-wrap overflow-y-auto max-h-80 text-text-muted select-all">
            {extracted.rawText}
          </pre>
        </div>
      </div>

      {/* Line items editor */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Line Items</h4>
          <div className="flex items-center gap-2">
            {totalMismatch && (
              <span className="flex items-center gap-1 text-xs text-accent">
                <AlertTriangle size={12} />
                Sum {formatCurrency(linesTotal, currency)} differs from total {formatCurrency(total, currency)}
              </span>
            )}
            <button onClick={clearAll} className="text-xs text-text-muted hover:text-danger">
              Clear all
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-2 py-2 font-medium text-text-muted">Description</th>
                <th className="text-right px-2 py-2 font-medium text-text-muted w-16">Qty</th>
                <th className="text-right px-2 py-2 font-medium text-text-muted w-24">Unit Price</th>
                <th className="text-right px-2 py-2 font-medium text-text-muted w-24">Total</th>
                <th className="text-left px-2 py-2 font-medium text-text-muted w-36">Category</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <LineRow
                  key={i}
                  line={line}
                  index={i}
                  currency={currency}
                  categories={categories}
                  selectedCategory={lineCategories[i] ?? ''}
                  onUpdate={updateLine}
                  onCategoryChange={updateCategory}
                  onDelete={deleteLine}
                />
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-text-muted text-sm">
                    No line items. Add manually or re-scan with better image quality.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-2 py-2">
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} /> Add line item
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-medium text-sm">
                  {formatCurrency(linesTotal, currency)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={cn(
          'rounded-md p-4 mb-4 text-sm',
          result.errors.length === 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
        )}>
          <p className="font-medium">
            {result.errors.length === 0
              ? `Imported ${result.created} line items`
              : `${result.errors.length} errors`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={onCancel} disabled={importing} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={importing || !merchant || !receiptDate || lines.length === 0 || (!matchTransactionId && !selectedAccountId) || !!result}
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
              Import {lines.filter((l) => l.description && l.total).length} Line Items
            </>
          )}
        </button>
      </div>
    </div>
  )
}
