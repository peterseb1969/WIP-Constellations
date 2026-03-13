import { useState, useCallback } from 'react'
import { useDocuments, useCreateDocument, useCreateDocuments, useUploadFile } from '@wip/react'
import { Upload, FileUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardTitle } from '../components/Card'
import ErrorBanner from '../components/ErrorBanner'
import { config } from '../lib/config'
import { parseUbsCsv } from '../lib/ubs-parser'
import { parseYuhPdfText } from '../lib/yuh-parser'
import { parsePayslipPdfText } from '../lib/payslip-parser'
import { extractPdfText, detectPdfType } from '../lib/pdf-extract'
import { formatCurrency } from '../lib/utils'

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

type ParsedImport =
  | { type: 'transactions'; iban: string; currency: string; institution: string; transactions: TransactionPreview[] }
  | { type: 'payslip'; payslip: PayslipPreview }

interface TransactionPreview {
  sourceReference: string
  bookingDate: string
  valueDate: string
  currency: string
  amount: number
  balance: number | null
  transactionType: string
  description: string
  counterpartyName: string
}

interface PayslipPreview {
  employeeNumber: string
  period: string
  payDate: string
  currency: string
  gross: number
  net: number
  paymentAmount: number
  totalSocialContributions: number
  totalPensionContributions: number
  totalDeductions: number
  capacityUtilization: number | null
  targetIban: string
  lines: Array<{
    code: string
    description: string
    category: string
    amount: number
    basis: number | null
    rate: number | null
    isDeduction: boolean
  }>
}

interface ImportResult {
  total: number
  succeeded: number
  failed: number
  label: string
}

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsedData, setParsedData] = useState<ParsedImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploadedFilename, setUploadedFilename] = useState<string>('')

  const accounts = useDocuments({ template_id: config.templateIds.ACCOUNT, page_size: 100, latest_only: true })
  const createDoc = useCreateDocument()
  const createDocs = useCreateDocuments()
  const uploadFile = useUploadFile()

  const createImportRecord = useCallback(async (opts: {
    documentType: string
    parser: string
    accountId?: string
    transactionsCreated: number
    periodFrom?: string
    periodTo?: string
    status: string
  }) => {
    if (!uploadedFileId) return
    try {
      await new Promise<void>((resolve, reject) => {
        createDoc.mutate(
          {
            template_id: config.templateIds.IMPORT,
            data: {
              file: uploadedFileId,
              filename: uploadedFilename,
              import_date: new Date().toISOString(),
              document_type: opts.documentType,
              parser: opts.parser,
              account: opts.accountId || undefined,
              transactions_created: opts.transactionsCreated,
              period_from: opts.periodFrom || undefined,
              period_to: opts.periodTo || undefined,
              status: opts.status,
            },
          },
          { onSuccess: () => resolve(), onError: reject },
        )
      })
    } catch (err) {
      console.warn('[Import] Failed to create import record:', err)
    }
  }, [uploadedFileId, uploadedFilename, createDoc])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ''

    setError(null)
    setParsedData(null)
    setUploadedFilename(file.name)

    try {
      // Upload file to WIP file store
      let fileId: string | null = null
      try {
        const uploaded = await new Promise<{ file_id: string }>((resolve, reject) => {
          uploadFile.mutate(
            { file, filename: file.name, metadata: { tags: ['import', 'statement'] } },
            { onSuccess: (r) => resolve(r as unknown as { file_id: string }), onError: reject },
          )
        })
        fileId = uploaded.file_id
      } catch {
        // File upload is best-effort — don't block import if it fails
        console.warn('[Import] File upload to WIP failed, continuing with import')
      }
      setUploadedFileId(fileId)

      if (file.name.toLowerCase().endsWith('.csv')) {
        // UBS CSV
        const text = await file.text()
        const parsed = parseUbsCsv(text)
        if (parsed.transactions.length === 0) {
          setError('No transactions found in the CSV file.')
          return
        }
        setParsedData({
          type: 'transactions',
          iban: parsed.iban,
          currency: parsed.currency,
          institution: 'UBS',
          transactions: parsed.transactions,
        })
        setStep('preview')
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF — detect type
        const pdfText = await extractPdfText(file)
        const docType = detectPdfType(pdfText)

        if (docType === 'yuh-statement') {
          const parsed = parseYuhPdfText(pdfText)
          if (parsed.transactions.length === 0) {
            setError('No transactions found in the Yuh statement.')
            return
          }
          setParsedData({
            type: 'transactions',
            iban: parsed.iban,
            currency: 'CHF',
            institution: 'Yuh / Swissquote',
            transactions: parsed.transactions,
          })
          setStep('preview')
        } else if (docType === 'roche-payslip') {
          const parsed = parsePayslipPdfText(pdfText)
          if (!parsed.period) {
            setError('Could not extract pay period from the payslip PDF.')
            return
          }
          setParsedData({ type: 'payslip', payslip: parsed })
          setStep('preview')
        } else {
          setError('Unrecognized PDF format. Supported: Yuh bank statements, Roche payslips.')
        }
      } else {
        setError('Unsupported file type. Please upload a .csv or .pdf file.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }, [])

  const importTransactions = useCallback(async (data: Extract<ParsedImport, { type: 'transactions' }>) => {
    setStep('importing')
    setProgress(0)

    // Step 1: Ensure account exists
    const existingAccount = accounts.data?.items.find(
      (doc) => (doc.data as Record<string, unknown>).iban === data.iban
    )

    let accountId: string
    if (existingAccount) {
      accountId = existingAccount.document_id
    } else {
      const res = await new Promise<string>((resolve, reject) => {
        createDoc.mutate(
          {
            template_id: config.templateIds.ACCOUNT,
            data: {
              iban: data.iban,
              institution: data.institution,
              account_type: 'CHECKING',
              primary_currency: data.currency,
            },
          },
          {
            onSuccess: (r) => resolve(r.id ?? r.document_id ?? ''),
            onError: reject,
          },
        )
      })
      accountId = res
    }

    // Step 2: Import transactions in batches
    const BATCH_SIZE = 50
    const txDocs = data.transactions
      .filter((tx) => tx.amount !== 0)
      .map((tx) => ({
        template_id: config.templateIds.TRANSACTION,
        data: {
          account: accountId,
          source_reference: tx.sourceReference,
          booking_date: tx.bookingDate,
          value_date: tx.valueDate,
          currency: tx.currency,
          amount: tx.amount,
          balance_after: tx.balance ?? undefined,
          transaction_type: tx.transactionType,
          description: tx.description,
          counterparty_name: tx.counterpartyName || undefined,
        },
      }))

    let totalSucceeded = 0
    let totalFailed = 0

    for (let i = 0; i < txDocs.length; i += BATCH_SIZE) {
      const batch = txDocs.slice(i, i + BATCH_SIZE)
      try {
        await new Promise<void>((resolve, reject) => {
          createDocs.mutate(batch, {
            onSuccess: (res) => {
              totalSucceeded += res.succeeded
              totalFailed += res.failed
              resolve()
            },
            onError: reject,
          })
        })
      } catch {
        totalFailed += batch.length
      }
      setProgress(Math.min(100, Math.round(((i + batch.length) / txDocs.length) * 100)))
    }

    // Determine date range
    const dates = data.transactions.map(tx => tx.bookingDate).filter(Boolean).sort()
    const periodFrom = dates[0]
    const periodTo = dates[dates.length - 1]

    setResult({ total: txDocs.length, succeeded: totalSucceeded, failed: totalFailed, label: 'transactions' })
    setStep('done')

    // Create FIN_IMPORT record (best-effort, after UI updates)
    const parserName = data.institution.toLowerCase().includes('yuh') ? 'yuh' : 'ubs'
    await createImportRecord({
      documentType: 'BANK_STATEMENT',
      parser: parserName,
      accountId: accountId,
      transactionsCreated: totalSucceeded,
      periodFrom,
      periodTo,
      status: totalFailed === 0 ? 'success' : 'partial',
    })
  }, [accounts.data, createDoc, createDocs, createImportRecord])

  const importPayslip = useCallback(async (data: PayslipPreview) => {
    setStep('importing')
    setProgress(0)

    // Step 1: Ensure employer account exists
    const employerIban = 'EMPLOYER-ROCHE-CH'
    const existingEmployer = accounts.data?.items.find(
      (doc) => (doc.data as Record<string, unknown>).iban === employerIban
    )

    let employerId: string
    if (existingEmployer) {
      employerId = existingEmployer.document_id
    } else {
      const res = await new Promise<string>((resolve, reject) => {
        createDoc.mutate(
          {
            template_id: config.templateIds.ACCOUNT,
            data: {
              iban: employerIban,
              institution: 'F. Hoffmann-La Roche AG',
              account_type: 'EMPLOYER',
              primary_currency: 'CHF',
              holder_name: 'F. Hoffmann-La Roche AG',
            },
          },
          {
            onSuccess: (r) => resolve(r.id ?? r.document_id ?? ''),
            onError: reject,
          },
        )
      })
      employerId = res
    }

    setProgress(20)

    // Step 2: Create payslip document
    const payslipRes = await new Promise<string>((resolve, reject) => {
      createDoc.mutate(
        {
          template_id: config.templateIds.PAYSLIP,
          data: {
            employer: employerId,
            period: data.period,
            pay_date: data.payDate,
            currency: data.currency,
            gross: data.gross,
            net: data.net,
            payment_amount: data.paymentAmount,
            total_social_contributions: data.totalSocialContributions || undefined,
            total_pension_contributions: data.totalPensionContributions || undefined,
            total_deductions: data.totalDeductions || undefined,
            employee_number: data.employeeNumber || undefined,
            capacity_utilization: data.capacityUtilization ?? undefined,
            target_iban: data.targetIban || undefined,
          },
        },
        {
          onSuccess: (r) => resolve(r.id ?? r.document_id ?? ''),
          onError: reject,
        },
      )
    })

    setProgress(50)

    // Step 3: Create payslip line items
    let linesSucceeded = 0
    let linesFailed = 0

    if (data.lines.length > 0) {
      const lineDocs = data.lines.map((line) => ({
        template_id: config.templateIds.PAYSLIP_LINE,
        data: {
          payslip: payslipRes,
          code: line.code,
          description: line.description,
          category: line.category,
          amount: line.amount,
          basis: line.basis ?? undefined,
          rate: line.rate ?? undefined,
          is_deduction: line.isDeduction,
        },
      }))

      await new Promise<void>((resolve, reject) => {
        createDocs.mutate(lineDocs, {
          onSuccess: (res) => {
            linesSucceeded = res.succeeded
            linesFailed = res.failed
            resolve()
          },
          onError: reject,
        })
      })
    }

    setProgress(100)

    const totalItems = 1 + data.lines.length
    setResult({
      total: totalItems,
      succeeded: 1 + linesSucceeded,
      failed: linesFailed,
      label: `payslip (${data.period}) + ${data.lines.length} line items`,
    })
    setStep('done')

    await createImportRecord({
      documentType: 'PAYSLIP',
      parser: 'roche_payslip',
      transactionsCreated: 1 + linesSucceeded,
      periodFrom: data.period + '-01',
      periodTo: data.period + '-28',
      status: linesFailed === 0 ? 'success' : 'partial',
    })
  }, [accounts.data, createDoc, createDocs, createImportRecord])

  const handleImport = useCallback(async () => {
    if (!parsedData) return
    try {
      if (parsedData.type === 'transactions') {
        await importTransactions(parsedData)
      } else {
        await importPayslip(parsedData.payslip)
      }
    } catch (err) {
      console.error('[Import] Error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      const detail = err && typeof err === 'object' && 'detail' in err ? ` — ${JSON.stringify((err as Record<string, unknown>).detail)}` : ''
      setError(`Import failed: ${msg}${detail}`)
      setStep('preview')
    }
  }, [parsedData, importTransactions, importPayslip])

  const handleReset = () => {
    setStep('upload')
    setParsedData(null)
    setError(null)
    setResult(null)
    setProgress(0)
    setUploadedFileId(null)
    setUploadedFilename('')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Import Statements</h2>

      {error && <ErrorBanner error={new Error(error)} />}

      {step === 'upload' && (
        <Card>
          <CardTitle>Upload Statement or Payslip</CardTitle>
          <p className="text-sm text-text-muted mb-4">
            Supported formats: UBS CSV, Yuh/Swissquote PDF statements, Roche payslip PDF.
          </p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-10 h-10 text-text-muted mb-3" />
            <span className="text-sm font-medium">Click to upload file</span>
            <span className="text-xs text-text-muted mt-1">.csv or .pdf</span>
            <input
              type="file"
              accept=".csv,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </Card>
      )}

      {step === 'preview' && parsedData?.type === 'transactions' && (
        <Card>
          <CardTitle>Transaction Import Preview</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Institution:</span>
                <p className="font-medium">{parsedData.institution}</p>
              </div>
              <div>
                <span className="text-text-muted">IBAN:</span>
                <p className="font-mono font-medium text-xs">{parsedData.iban || 'Not detected'}</p>
              </div>
              <div>
                <span className="text-text-muted">Currency:</span>
                <p className="font-medium">{parsedData.currency}</p>
              </div>
              <div>
                <span className="text-text-muted">Transactions:</span>
                <p className="font-medium">{parsedData.transactions.length}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedData.transactions.slice(0, 5).map((tx, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 whitespace-nowrap">{tx.bookingDate}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{tx.transactionType}</span>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate">{tx.counterpartyName || tx.description}</td>
                      <td className={`px-3 py-2 text-right font-medium ${tx.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.transactions.length > 5 && (
                <p className="text-xs text-text-muted text-center py-2">
                  ... and {parsedData.transactions.length - 5} more
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                Import {parsedData.transactions.length} Transactions
              </button>
              <button onClick={handleReset} className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {step === 'preview' && parsedData?.type === 'payslip' && (
        <Card>
          <CardTitle>Payslip Import Preview</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Period:</span>
                <p className="font-medium">{parsedData.payslip.period}</p>
              </div>
              <div>
                <span className="text-text-muted">Employee #:</span>
                <p className="font-medium">{parsedData.payslip.employeeNumber || '-'}</p>
              </div>
              <div>
                <span className="text-text-muted">Gross:</span>
                <p className="font-semibold">{formatCurrency(parsedData.payslip.gross, parsedData.payslip.currency)}</p>
              </div>
              <div>
                <span className="text-text-muted">Net:</span>
                <p className="font-semibold text-success">{formatCurrency(parsedData.payslip.net, parsedData.payslip.currency)}</p>
              </div>
            </div>

            {parsedData.payslip.lines.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2">Code</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-left px-3 py-2">Category</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedData.payslip.lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs">{line.code}</td>
                        <td className="px-3 py-2">{line.description}</td>
                        <td className="px-3 py-2 text-text-muted">{line.category}</td>
                        <td className={`px-3 py-2 text-right font-medium ${line.isDeduction ? 'text-danger' : 'text-success'}`}>
                          {line.isDeduction ? '-' : '+'}{formatCurrency(line.amount, 'CHF')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                Import Payslip + {parsedData.payslip.lines.length} Line Items
              </button>
              <button onClick={handleReset} className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <div className="flex flex-col items-center py-8">
            <FileUp className="w-10 h-10 text-primary animate-pulse mb-4" />
            <p className="font-semibold mb-2">Importing...</p>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-text-muted mt-2">{progress}%</p>
          </div>
        </Card>
      )}

      {step === 'done' && result && (
        <Card>
          <div className="flex flex-col items-center py-8">
            {result.failed === 0 ? (
              <CheckCircle2 className="w-12 h-12 text-success mb-4" />
            ) : (
              <AlertCircle className="w-12 h-12 text-accent mb-4" />
            )}
            <p className="text-lg font-semibold mb-2">Import Complete</p>
            <div className="text-sm text-text-muted space-y-1 text-center">
              <p>{result.succeeded} of {result.total} {result.label} imported successfully</p>
              {result.failed > 0 && <p className="text-danger">{result.failed} failed</p>}
              {uploadedFileId && <p className="text-xs">Source file stored in WIP ({uploadedFileId})</p>}
            </div>
            <button
              onClick={handleReset}
              className="mt-6 bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Import Another File
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
