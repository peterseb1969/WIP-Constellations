import Papa from 'papaparse'

export interface DkbHeader {
  accountType: string
  iban: string
  period: string
  balance: number
  currency: string
}

export interface DkbTransaction {
  bookingDate: string
  valueDate: string
  status: string
  payer: string
  payee: string
  purpose: string
  transactionType: string // Ausgang / Eingang
  iban: string
  amount: number
  creditorId: string
  mandateRef: string
  customerRef: string
}

export interface ParsedDkbCsv {
  header: DkbHeader
  transactions: DkbTransaction[]
}

/**
 * Detect whether a semicolon-delimited CSV is a DKB Umsatzliste.
 * DKB files have "Buchungsdatum" as first column header and "Girokonto" on line 1.
 */
export function isDkbCsv(text: string): boolean {
  const lines = text.split('\n')
  const first = lines[0] ?? ''
  if (!first.includes('Girokonto')) return false
  // Look for the header row with "Buchungsdatum"
  for (let i = 1; i < Math.min(lines.length, 8); i++) {
    if (lines[i]?.includes('Buchungsdatum')) return true
  }
  return false
}

/**
 * Parse German number format: dot = thousands, comma = decimal.
 * "-1.255,34" → -1255.34
 */
function parseGermanNumber(val: string): number {
  if (!val || val.trim() === '') return 0
  const cleaned = val.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Parse German date DD.MM.YY → YYYY-MM-DD.
 * Assumes 2000s for YY < 50, 1900s otherwise.
 */
function parseGermanDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.trim().split('.')
  if (parts.length !== 3) return dateStr
  const day = parts[0].padStart(2, '0')
  const month = parts[1].padStart(2, '0')
  let year = parts[2]
  if (year.length === 2) {
    const yy = parseInt(year, 10)
    year = (yy < 50 ? '20' : '19') + year
  }
  return `${year}-${month}-${day}`
}

/**
 * Guess transaction type from DKB fields.
 */
function guessTransactionType(tx: DkbTransaction): string {
  const purpose = tx.purpose.toLowerCase()
  const payee = tx.payee.toLowerCase()

  if (purpose.includes('visa debitkartenumsatz')) return 'DEBIT_CARD'
  if (purpose.includes('lastschrift') || tx.creditorId) return 'BANK_TRANSFER_OUT'
  if (purpose.includes('dauerauftrag')) return 'STANDING_ORDER'
  if (purpose.includes('abrechnung') && payee.includes('dkb')) return 'FEE'
  if (purpose.includes('zinsen') || purpose.includes('zins')) return 'BANK_TRANSFER_IN'

  if (tx.transactionType === 'Eingang') return 'BANK_TRANSFER_IN'
  if (tx.transactionType === 'Ausgang') return 'BANK_TRANSFER_OUT'

  return 'OTHER'
}

/**
 * Generate a stable source_reference from DKB transaction fields.
 * DKB doesn't provide a unique transaction ID, so we synthesize one.
 */
function generateSourceRef(tx: DkbTransaction, index: number): string {
  if (tx.customerRef && tx.customerRef.trim()) {
    return `DKB-${tx.customerRef.trim()}`
  }
  // Fallback: date + amount + index for uniqueness
  return `DKB-${tx.bookingDate}-${tx.amount}-${index}`
}

export function parseDkbCsv(csvText: string): ParsedDkbCsv {
  const result = Papa.parse<string[]>(csvText, {
    delimiter: ';',
    header: false,
    skipEmptyLines: false,
  })

  const allRows = result.data

  // Find header row (contains "Buchungsdatum")
  const headerRowIndex = allRows.findIndex((row) =>
    row[0]?.replace(/"/g, '').trim() === 'Buchungsdatum',
  )

  if (headerRowIndex === -1) {
    throw new Error('Could not find column headers in CSV. Expected "Buchungsdatum" column.')
  }

  // Parse metadata (lines before column headers)
  const metaLines = allRows.slice(0, headerRowIndex)
  const accountLine = metaLines[0] ?? []
  const periodLine = metaLines.find((l) => l[0]?.includes('Zeitraum'))
  const balanceLine = metaLines.find((l) => l[0]?.includes('Kontostand'))

  const balanceStr = balanceLine?.[1]?.replace('€', '').trim() ?? '0'

  const header: DkbHeader = {
    accountType: accountLine[0]?.replace(/"/g, '').trim() ?? '',
    iban: accountLine[1]?.replace(/"/g, '').trim() ?? '',
    period: periodLine?.[1]?.replace(/"/g, '').trim() ?? '',
    balance: parseGermanNumber(balanceStr),
    currency: 'EUR',
  }

  // Parse data rows
  const dataRows = allRows.slice(headerRowIndex + 1)
  const transactions: DkbTransaction[] = []

  for (const row of dataRows) {
    const bookingDate = row[0]?.replace(/"/g, '').trim() ?? ''
    if (!bookingDate) continue

    transactions.push({
      bookingDate,
      valueDate: row[1]?.replace(/"/g, '').trim() ?? '',
      status: row[2]?.replace(/"/g, '').trim() ?? '',
      payer: row[3]?.replace(/"/g, '').trim() ?? '',
      payee: row[4]?.replace(/"/g, '').trim() ?? '',
      purpose: row[5]?.replace(/"/g, '').trim() ?? '',
      transactionType: row[6]?.replace(/"/g, '').trim() ?? '',
      iban: row[7]?.replace(/"/g, '').trim() ?? '',
      amount: parseGermanNumber(row[8]?.replace(/"/g, '') ?? ''),
      creditorId: row[9]?.replace(/"/g, '').trim() ?? '',
      mandateRef: row[10]?.replace(/"/g, '').trim() ?? '',
      customerRef: row[11]?.replace(/"/g, '').trim() ?? '',
    })
  }

  return { header, transactions }
}

/**
 * Convert a parsed DKB transaction to a WIP FIN_TRANSACTION data record.
 */
export function toWipTransaction(
  tx: DkbTransaction,
  accountDocId: string,
  index: number,
): Record<string, unknown> | null {
  if (tx.amount === 0 && !tx.purpose) return null

  const sourceRef = generateSourceRef(tx, index)
  const bookingDate = parseGermanDate(tx.bookingDate)
  const valueDate = parseGermanDate(tx.valueDate)

  // Determine counterparty: for outgoing = payee, for incoming = payer
  const isOutgoing = tx.transactionType === 'Ausgang'
  const counterparty = isOutgoing ? tx.payee : tx.payer

  const data: Record<string, unknown> = {
    account: accountDocId,
    source_reference: sourceRef,
    booking_date: bookingDate,
    currency: 'EUR',
    amount: tx.amount,
    transaction_type: guessTransactionType(tx),
    description: tx.purpose,
  }

  if (valueDate && valueDate !== bookingDate) data.value_date = valueDate
  if (counterparty && counterparty !== 'NOTPROVIDED') data.counterparty_name = counterparty
  if (tx.iban) data.counterparty_iban = tx.iban
  if (tx.mandateRef) data.reference_number = tx.mandateRef

  // Store full details for traceability
  const rawParts = [tx.payer, tx.payee, tx.purpose, tx.creditorId, tx.mandateRef, tx.customerRef]
    .filter(Boolean)
    .join(' | ')
  if (rawParts) data.raw_details = rawParts

  return data
}
