import Papa from 'papaparse'

export interface UbsHeader {
  accountNumber: string
  iban: string
  from: string
  to: string
  openingBalance: number
  closingBalance: number
  currency: string
  transactionCount: number
}

export interface UbsTransaction {
  closingDate: string
  closingTime: string
  bookingDate: string
  valueDate: string
  currency: string
  debit: number | null
  credit: number | null
  singleAmount: number | null
  balance: number | null
  transactionId: string
  description1: string
  description2: string
  description3: string
  footnotes: string
}

export interface ParsedUbsCsv {
  header: UbsHeader
  transactions: UbsTransaction[]
}

/**
 * Extract counterparty name from UBS Beschreibung1 field.
 * Format: "Name;Address; City; Country" — take first semicolon-separated part.
 */
export function extractCounterparty(desc1: string): { name: string; address: string } {
  if (!desc1) return { name: '', address: '' }
  const parts = desc1.split(';').map((s) => s.trim())
  return {
    name: parts[0] || '',
    address: parts.slice(1).filter(Boolean).join(', '),
  }
}

/**
 * Extract IBAN from UBS Beschreibung3 field.
 * Looks for "Konto-Nr. IBAN: CH..." pattern.
 */
export function extractIban(desc3: string): string | null {
  const match = desc3?.match(/Konto-Nr\. IBAN:\s*([A-Z]{2}\d{2}\s[\d\sA-Z]+?)(?:;|$)/)
  if (!match) return null
  return match[1].replace(/\s/g, '')
}

/**
 * Extract QRR reference from Beschreibung3.
 */
export function extractReference(desc3: string): string | null {
  const match = desc3?.match(/Referenz-Nr\. QRR:\s*([\d\s]+?)(?:;|$)/)
  if (!match) return null
  return match[1].trim()
}

/**
 * Extract card number from Beschreibung2.
 * Format: "18810344-0 04/28; Zahlung Debitkarte"
 */
export function extractCardNumber(desc2: string): string | null {
  const match = desc2?.match(/^(\d{8}-\d\s\d{2}\/\d{2})/)
  return match ? match[1] : null
}

/**
 * Determine the transaction amount from debit/credit/singleAmount fields.
 * Debit values from UBS are already negative.
 */
export function resolveAmount(tx: UbsTransaction): number | null {
  if (tx.debit != null) return tx.debit
  if (tx.credit != null) return tx.credit
  if (tx.singleAmount != null) return tx.singleAmount
  return null
}

/**
 * Guess transaction type from UBS description fields.
 */
export function guessTransactionType(tx: UbsTransaction): string {
  const d2 = tx.description2.toLowerCase()
  if (d2.includes('debitkarte') || d2.includes('zahlung debitkarte')) return 'DEBIT_CARD'
  if (d2.includes('e-bill') || d2.includes('ebill')) return 'E_BILL'
  if (d2.includes('dauerauftrag')) return 'STANDING_ORDER'
  if (d2.includes('gutschrift') || d2.includes('e-banking-gutschrift')) return 'CREDIT_TRANSFER'
  if (d2.includes('vergütung') || d2.includes('e-banking-vergütungsauftrag')) return 'BANK_TRANSFER'
  if (d2.includes('währung') || tx.description1.toLowerCase().includes('währung')) return 'CURRENCY_EXCHANGE'
  if (tx.description1.toLowerCase().includes('saldo dienstleistungspreis')) return 'FEE'
  if (tx.description1.toLowerCase().includes('zins')) return 'INTEREST'
  if (d2.includes('lohn') || d2.includes('salär') || d2.includes('gehalt')) return 'SALARY'
  return 'OTHER'
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === '') return null
  // UBS uses no thousands separator, dot for decimals
  return parseFloat(val.replace(/'/g, ''))
}

function parseHeaderValue(lines: string[][], key: string): string {
  const row = lines.find((l) => l[0]?.startsWith(key))
  return row?.[1]?.trim() ?? ''
}

export function parseUbsCsv(csvText: string): ParsedUbsCsv {
  const result = Papa.parse<string[]>(csvText, {
    delimiter: ';',
    header: false,
    skipEmptyLines: false,
  })

  const allRows = result.data

  // Find the header row (contains "Abschlussdatum")
  const headerRowIndex = allRows.findIndex((row) =>
    row[0]?.trim() === 'Abschlussdatum',
  )

  if (headerRowIndex === -1) {
    throw new Error('Could not find column headers in CSV. Expected "Abschlussdatum" column.')
  }

  // Parse file header (lines before column headers)
  const metaLines = allRows.slice(0, headerRowIndex)
  const header: UbsHeader = {
    accountNumber: parseHeaderValue(metaLines, 'Kontonummer:'),
    iban: parseHeaderValue(metaLines, 'IBAN:').replace(/\s/g, ''),
    from: parseHeaderValue(metaLines, 'Von:'),
    to: parseHeaderValue(metaLines, 'Bis:'),
    openingBalance: parseFloat(parseHeaderValue(metaLines, 'Anfangssaldo:')) || 0,
    closingBalance: parseFloat(parseHeaderValue(metaLines, 'Schlusssaldo:')) || 0,
    currency: parseHeaderValue(metaLines, 'Bewertet in:'),
    transactionCount: parseInt(parseHeaderValue(metaLines, 'Anzahl Transaktionen'), 10) || 0,
  }

  // Parse data rows (after column header row)
  const dataRows = allRows.slice(headerRowIndex + 1)
  const transactions: UbsTransaction[] = []

  for (const row of dataRows) {
    // Skip empty rows
    if (!row[0] && !row[2] && !row[9]) continue

    transactions.push({
      closingDate: row[0]?.trim() ?? '',
      closingTime: row[1]?.trim() ?? '',
      bookingDate: row[2]?.trim() ?? '',
      valueDate: row[3]?.trim() ?? '',
      currency: row[4]?.trim() ?? '',
      debit: parseNumber(row[5] ?? ''),
      credit: parseNumber(row[6] ?? ''),
      singleAmount: parseNumber(row[7] ?? ''),
      balance: parseNumber(row[8] ?? ''),
      transactionId: row[9]?.trim() ?? '',
      description1: row[10]?.trim() ?? '',
      description2: row[11]?.trim() ?? '',
      description3: row[12]?.trim() ?? '',
      footnotes: row[13]?.trim() ?? '',
    })
  }

  return { header, transactions }
}

/**
 * Convert a parsed UBS transaction to a WIP FIN_TRANSACTION data record.
 */
export function toWipTransaction(
  tx: UbsTransaction,
  accountDocId: string,
): Record<string, unknown> | null {
  const amount = resolveAmount(tx)
  if (amount == null) return null // skip rows with no amount (e.g. fee summaries)
  if (!tx.transactionId) return null

  const counterparty = extractCounterparty(tx.description1)
  const iban = extractIban(tx.description3)
  const reference = extractReference(tx.description3)
  const card = extractCardNumber(tx.description2)

  const data: Record<string, unknown> = {
    account: accountDocId,
    source_reference: tx.transactionId,
    booking_date: tx.bookingDate,
    currency: tx.currency || 'CHF',
    amount,
    transaction_type: guessTransactionType(tx),
  }

  if (tx.valueDate) data.value_date = tx.valueDate
  if (tx.balance != null) data.balance_after = tx.balance
  if (counterparty.name) data.counterparty_name = counterparty.name
  if (counterparty.address) data.counterparty_address = counterparty.address
  if (iban) data.counterparty_iban = iban
  if (reference) data.reference_number = reference
  if (card) data.card_number = card

  // Beschreibung2 = description (transaction method + user-provided labels)
  if (tx.description2) data.description = tx.description2

  // Beschreibung3 = raw_details (full string with references, IBANs, costs)
  if (tx.description3) data.raw_details = tx.description3

  return data
}
