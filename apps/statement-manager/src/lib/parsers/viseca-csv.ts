import Papa from 'papaparse'

export interface VisecaTransaction {
  transactionId: string
  cardId: string
  date: string
  valutaDate: string
  amount: number
  currency: string
  originalAmount: number
  originalCurrency: string
  merchantName: string
  merchantPlace: string
  merchantCountry: string
  stateType: string
  details: string
  type: string
  exchangeRate: number
}

export interface ParsedVisecaCsv {
  cardId: string
  transactions: VisecaTransaction[]
  period: { from: string; to: string }
  currency: string
}

/**
 * Detect whether a CSV text is a Viseca credit card export.
 * Viseca files start with "TransactionId,CardId," header.
 */
export function isVisecaCsv(text: string): boolean {
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  return firstLine.startsWith('TransactionId,CardId,')
}

/**
 * Map Viseca 3-letter country codes (ISO 3166-1 alpha-3) to WIP COUNTRY term values.
 * WIP COUNTRY terminology uses alpha-2 codes.
 */
const COUNTRY_MAP: Record<string, string> = {
  CHE: 'CH',
  DEU: 'DE',
  FRA: 'FR',
  ITA: 'IT',
  AUT: 'AT',
  GBR: 'GB',
  USA: 'US',
  ESP: 'ES',
  PRT: 'PT',
  NLD: 'NL',
  BEL: 'BE',
  LUX: 'LU',
  SWE: 'SE',
  NOR: 'NO',
  DNK: 'DK',
  FIN: 'FI',
  POL: 'PL',
  CZE: 'CZ',
  HUN: 'HU',
  GRC: 'GR',
  TUR: 'TR',
  JPN: 'JP',
  CHN: 'CN',
  SGP: 'SG',
  HKG: 'HK',
  THA: 'TH',
  IRL: 'IE',
  CAN: 'CA',
  AUS: 'AU',
  NZL: 'NZ',
  BRA: 'BR',
  MEX: 'MX',
  ARE: 'AE',
  HRV: 'HR',
  SVN: 'SI',
  BGR: 'BG',
  ROU: 'RO',
  ISL: 'IS',
  LIE: 'LI',
  MCO: 'MC',
  AND: 'AD',
  MLT: 'MT',
  CYP: 'CY',
  EST: 'EE',
  LVA: 'LV',
  LTU: 'LT',
  SVK: 'SK',
}

function mapCountry(alpha3: string): string | null {
  if (!alpha3) return null
  return COUNTRY_MAP[alpha3.toUpperCase()] ?? null
}

function parseNumber(val: string): number {
  if (!val || val.trim() === '') return 0
  return parseFloat(val)
}

/**
 * Extract date portion (YYYY-MM-DD) from Viseca datetime string.
 * Input format: "2024-03-01 14:09:15"
 */
function extractDate(datetime: string): string {
  return datetime?.split(' ')[0] ?? ''
}

export function parseVisecaCsv(csvText: string): ParsedVisecaCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    delimiter: ',',
    header: true,
    skipEmptyLines: true,
  })

  const transactions: VisecaTransaction[] = []
  let cardId = ''
  let minDate = ''
  let maxDate = ''
  let currency = 'CHF'

  for (const row of result.data) {
    if (!row.TransactionId) continue

    const tx: VisecaTransaction = {
      transactionId: row.TransactionId.trim(),
      cardId: row.CardId?.trim() ?? '',
      date: row.Date?.trim() ?? '',
      valutaDate: row.ValutaDate?.trim() ?? '',
      amount: parseNumber(row.Amount ?? ''),
      currency: row.Currency?.trim() ?? 'CHF',
      originalAmount: parseNumber(row.OriginalAmount ?? ''),
      originalCurrency: row.OriginalCurrency?.trim() ?? '',
      merchantName: row.MerchantName?.trim() ?? '',
      merchantPlace: row.MerchantPlace?.trim() ?? '',
      merchantCountry: row.MerchantCountry?.trim() ?? '',
      stateType: row.StateType?.trim() ?? '',
      details: row.Details?.trim() ?? '',
      type: row.Type?.trim() ?? '',
      exchangeRate: parseNumber(row['Exchange Rate'] ?? ''),
    }

    transactions.push(tx)

    if (!cardId && tx.cardId) cardId = tx.cardId
    currency = tx.currency

    const bookDate = extractDate(tx.valutaDate || tx.date)
    if (bookDate) {
      if (!minDate || bookDate < minDate) minDate = bookDate
      if (!maxDate || bookDate > maxDate) maxDate = bookDate
    }
  }

  return {
    cardId,
    transactions,
    period: { from: minDate, to: maxDate },
    currency,
  }
}

/**
 * Convert a parsed Viseca transaction to a WIP FIN_TRANSACTION data record.
 * All CC purchases are CREDIT_CARD_PURCHASE type.
 * Amounts are stored as negative (expenditure) to match bank convention.
 */
export function toWipTransaction(
  tx: VisecaTransaction,
  accountDocId: string,
): Record<string, unknown> {
  const bookingDate = extractDate(tx.valutaDate || tx.date)

  const data: Record<string, unknown> = {
    account: accountDocId,
    source_reference: tx.transactionId,
    booking_date: bookingDate,
    currency: tx.currency || 'CHF',
    amount: -Math.abs(tx.amount), // CC purchases are expenditures
    transaction_type: 'CREDIT_CARD_PURCHASE',
    counterparty_name: tx.merchantName,
    description: tx.details,
  }

  if (tx.valutaDate) data.value_date = extractDate(tx.valutaDate)
  if (tx.merchantPlace) data.merchant_city = tx.merchantPlace
  if (tx.merchantCountry) {
    const country = mapCountry(tx.merchantCountry)
    if (country) data.merchant_country = country
  }
  if (tx.date) data.transaction_datetime = tx.date.replace(' ', 'T')

  // Foreign currency: original differs from billing currency
  if (tx.originalCurrency && tx.originalCurrency !== tx.currency) {
    data.original_amount = -Math.abs(tx.originalAmount)
    data.original_currency = tx.originalCurrency
    if (tx.exchangeRate && tx.exchangeRate !== 1) {
      data.exchange_rate = tx.exchangeRate
      data.exchange_target_currency = tx.currency
    }
  }

  // Card number from CardId (already masked by Viseca)
  if (tx.cardId) data.card_number = tx.cardId

  return data
}
