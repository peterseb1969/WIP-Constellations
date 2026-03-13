/**
 * Parser for UBS CSV bank statements.
 *
 * UBS exports use semicolons, have several header rows before the data,
 * and German column names. Amounts are in Swiss number format (apostrophe
 * as thousands separator, period as decimal separator).
 */

export interface UbsTransaction {
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

const TRANSACTION_TYPE_MAP: Record<string, string> = {
  'e-banking': 'BANK_TRANSFER_OUT',
  'gutschrift': 'BANK_TRANSFER_IN',
  'debitkarte': 'DEBIT_CARD',
  'e-bill': 'E_BILL',
  'ebill': 'E_BILL',
  'paynet': 'E_BILL',
  'dauerauftrag': 'STANDING_ORDER',
  'twint': 'TWINT',
  'bancomat': 'ATM_WITHDRAWAL',
  'kreditkarte': 'CREDIT_CARD_PAYMENT',
  'dienstleistungspreis': 'FEE',
  'währungsumtausch': 'CURRENCY_EXCHANGE',
  'wahrungsumtausch': 'CURRENCY_EXCHANGE',
}

function detectTransactionType(desc: string): string {
  const lower = desc.toLowerCase()
  for (const [keyword, type] of Object.entries(TRANSACTION_TYPE_MAP)) {
    if (lower.includes(keyword)) return type
  }
  return 'OTHER'
}

function parseSwissNumber(value: string): number {
  if (!value || value.trim() === '') return 0
  return Number(value.replace(/'/g, '').replace(/,/g, '.'))
}

function parseSwissDate(value: string): string {
  // UBS format: DD.MM.YYYY → YYYY-MM-DD
  const parts = value.split('.')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return value
}

export function parseUbsCsv(csvText: string): {
  iban: string
  currency: string
  transactions: UbsTransaction[]
} {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)

  // Extract IBAN from header area (first few lines)
  let iban = ''
  let headerCurrency = 'CHF'
  let dataStartIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('IBAN')) {
      const match = line.match(/CH[\d\s]+\d/)
      if (match) {
        iban = match[0].replace(/\s/g, '')
      }
    }
    // Find the column header row
    if (line.startsWith('Abschlussdatum') || line.includes('Buchungsdatum;Valutadatum')) {
      dataStartIndex = i + 1
      break
    }
  }

  if (dataStartIndex === -1) {
    throw new Error('Could not find data header row in UBS CSV')
  }

  const transactions: UbsTransaction[] = []

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]!
    if (!line || line.startsWith('Saldo') || line.startsWith('Total')) continue

    // Split by semicolons. UBS columns:
    // Abschlussdatum;Abschlusszeit;Buchungsdatum;Valutadatum;Währung;Belastung;Gutschrift;Einzelbetrag;Saldo;Transaktions-Nr.;Beschreibung1;Beschreibung2;Beschreibung3;Fussnoten
    const cols = line.split(';')
    if (cols.length < 11) continue

    const bookingDateRaw = cols[2]?.trim() ?? ''
    const valueDateRaw = cols[3]?.trim() ?? ''
    const currency = cols[4]?.trim() || headerCurrency
    const debit = cols[5]?.trim() ?? ''
    const credit = cols[6]?.trim() ?? ''
    const balanceRaw = cols[8]?.trim() ?? ''
    const txRef = cols[9]?.trim() ?? ''
    const desc1 = cols[10]?.trim() ?? ''
    const desc2 = cols[11]?.trim() ?? ''
    const desc3 = cols[12]?.trim() ?? ''

    if (!txRef || !bookingDateRaw) continue

    // Amount: negative for debits, positive for credits
    let amount = 0
    if (debit) amount = -Math.abs(parseSwissNumber(debit))
    else if (credit) amount = Math.abs(parseSwissNumber(credit))

    const fullDescription = [desc1, desc2, desc3].filter(Boolean).join(' | ')

    transactions.push({
      sourceReference: txRef,
      bookingDate: parseSwissDate(bookingDateRaw),
      valueDate: valueDateRaw ? parseSwissDate(valueDateRaw) : parseSwissDate(bookingDateRaw),
      currency,
      amount,
      balance: balanceRaw ? parseSwissNumber(balanceRaw) : null,
      transactionType: detectTransactionType(fullDescription),
      description: fullDescription,
      counterpartyName: desc2 || '',
    })
  }

  return { iban, currency: headerCurrency, transactions }
}
