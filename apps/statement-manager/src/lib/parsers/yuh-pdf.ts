// @ts-expect-error pdf-parse has no type declarations
import pdfParse from 'pdf-parse'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YuhHeader {
  iban: string
  customerNumber: string
  swift: string
  holderName: string
  periodFrom: string
  periodTo: string
  documentDate: string
  openingBalance: number
  closingBalance: number
}

export interface YuhTransaction {
  bookingDate: string       // YYYY-MM-DD
  valuteDate: string        // YYYY-MM-DD
  currency: string          // CHF | USD | EUR
  reference: string         // 10-digit
  amount: number            // signed: negative = debit, positive = credit
  balanceAfter: number      // running saldo (can be negative)
  transactionType: string   // raw Yuh text, e.g. "Zahlung per Debitkarte"
  cardNumber: string | null // e.g. "xxxx 8748"
  counterpartyName: string | null
  counterpartyAddress: string | null
  counterpartyIban: string | null
  exchangeRate: number | null
  exchangeTargetCurrency: string | null
  rawBlock: string          // full multi-line block for debugging
}

export interface ParsedYuhPdf {
  header: YuhHeader
  transactions: YuhTransaction[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Boilerplate footer text that repeats on every page — strip it */
const BOILERPLATE_PATTERNS = [
  /^Die vorliegende Benachrichtigung/,
  /^dir und Yuh Ltd/,
  /^Bescheid ohne Unterschrift/,
  /^Swissquote Bank (?:Ltd|AG),/,
  /^©\d{4} Yuh/,
  /^Die Bankdienstleistungen/,
  /^die von der Eidgen/,
  /^Seite \d+ \/ \d+$/,
  /^Dokument erstellt am/,
  /^Vom \d{2}\.\d{2}\.\d{4} bis/,
  /^Herrn?\s/,
  /^IBAN\s*:/,
  /^\d{4}\s+\w+$/,   // address zip+city on its own line (after name lines in footer)
]

/** Matches a date at the start of a line: DD.MM.YYYY */
const DATE_LINE_RE = /^(\d{2}\.\d{2}\.\d{4})(.+)$/

/** The glued last line: ref(10) + amount + valutaDate + saldo */
const LAST_LINE_RE = /^(\d{10})(-?\d[\d']*\.\d{2})(\d{2}\.\d{2}\.\d{4})(-?\d[\d']*\.\d{2})$/

/** Currency section header: "Kontoauszug inCHF" (no space) */
const SECTION_HEADER_RE = /^Kontoauszug in(CHF|USD|EUR)$/

/** Column header line (glued) — skip it */
const COLUMN_HEADER_RE = /^DATUMINFORMATION/

/** Opening / closing balance entries — not transactions */
const OPENING_RE = /^(\d{2}\.\d{2}\.\d{4})Anfangsbestand\s+/
const CLOSING_RE = /^(\d{2}\.\d{2}\.\d{4})Schlussbilanz/

/** Summary lines in section header */
const SUMMARY_RE = /^(Saldo per|Total Belastung|Total Gutschrift)/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSwissNumber(s: string): number {
  return parseFloat(s.replace(/'/g, ''))
}

function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('.')
  return `${y}-${m}-${d}`
}

function isBoilerplate(line: string): boolean {
  return BOILERPLATE_PATTERNS.some((re) => re.test(line))
}

function stripBoilerplate(lines: string[]): string[] {
  return lines.filter((l) => !isBoilerplate(l))
}

// ---------------------------------------------------------------------------
// Header extraction (page 1)
// ---------------------------------------------------------------------------

function extractHeader(text: string): YuhHeader {
  const periodMatch = text.match(
    /Kontoauszug\s*v\s*o\s*m\s+(\d{2}\.\d{2}\.\d{4})\s+bis\s+(\d{2}\.\d{2}\.\d{4})/,
  )
  const docDateMatch = text.match(/Dokument erstellt am\s+(\d{2}\.\d{2}\.\d{4})/)
  const ibanMatch = text.match(/IBAN\s*\n\s*(CH[\d\s]+\d)/)
  const kundeMatch = text.match(/Kunde\s+(\d+)/)
  const swiftMatch = text.match(/SWIFT\s*([A-Z\s]+XXX)/)
  const nameMatch = text.match(/(?:Herrn?|Frau)\s+(.+?)(?:\n)/)

  // Opening/closing from first page summary
  const openingMatch = text.match(/Anfangssaldo\s*\n\s*([\d']+\.\d{2})\s+CHF/)
  const closingMatch = text.match(/Endsaldo\s*\n\s*([\d']+\.\d{2})\s+CHF/)

  return {
    iban: (ibanMatch?.[1] ?? '').replace(/\s/g, ''),
    customerNumber: kundeMatch?.[1] ?? '',
    swift: (swiftMatch?.[1] ?? '').replace(/\s+/g, ' ').trim(),
    holderName: nameMatch?.[1]?.trim() ?? '',
    periodFrom: periodMatch ? toIsoDate(periodMatch[1]) : '',
    periodTo: periodMatch ? toIsoDate(periodMatch[2]) : '',
    documentDate: docDateMatch ? toIsoDate(docDateMatch[1]) : '',
    openingBalance: openingMatch ? parseSwissNumber(openingMatch[1]) : 0,
    closingBalance: closingMatch ? parseSwissNumber(closingMatch[1]) : 0,
  }
}

// ---------------------------------------------------------------------------
// Transaction block parsing
// ---------------------------------------------------------------------------

interface RawBlock {
  bookingDate: string     // DD.MM.YYYY
  typeLine: string        // rest of the first line after the date
  middleLines: string[]   // detail lines
  reference: string
  amount: number          // unsigned from regex
  valutaDate: string      // DD.MM.YYYY
  saldo: number           // signed
}

function parseTransactionBlocks(lines: string[], _currency: string): RawBlock[] {
  const blocks: RawBlock[] = []
  let current: { date: string; typeLine: string; middleLines: string[] } | null = null

  for (const line of lines) {
    // Skip section headers, column headers, summaries
    if (SECTION_HEADER_RE.test(line)) continue
    if (COLUMN_HEADER_RE.test(line)) continue
    if (SUMMARY_RE.test(line)) continue

    // Skip opening/closing balance entries
    if (OPENING_RE.test(line)) continue
    if (CLOSING_RE.test(line)) continue

    // Check if this is the last line of a block (ref + amount + valuta + saldo)
    const lastMatch = LAST_LINE_RE.exec(line)
    if (lastMatch && current) {
      blocks.push({
        bookingDate: current.date,
        typeLine: current.typeLine,
        middleLines: current.middleLines,
        reference: lastMatch[1],
        amount: parseSwissNumber(lastMatch[2]),
        valutaDate: lastMatch[3],
        saldo: parseSwissNumber(lastMatch[4]),
      })
      current = null
      continue
    }

    // Check if this starts a new transaction block (date glued to type)
    const dateMatch = DATE_LINE_RE.exec(line)
    if (dateMatch) {
      // If we had an open block without a last-line match, discard it (shouldn't happen)
      current = {
        date: dateMatch[1],
        typeLine: dateMatch[2].trim(),
        middleLines: [],
      }
      continue
    }

    // Otherwise it's a middle line of the current block
    if (current) {
      current.middleLines.push(line)
    }
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Sign determination + detail extraction
// ---------------------------------------------------------------------------

function determineSign(
  block: RawBlock,
  previousSaldo: number,
): number {
  // Balance diff tells us the true sign
  const diff = block.saldo - previousSaldo
  // The amount from the regex is unsigned — apply sign from balance diff
  if (Math.abs(Math.abs(diff) - block.amount) < 0.015) {
    return diff < 0 ? -block.amount : block.amount
  }
  // Fallback: use transaction type hint
  const type = block.typeLine.toLowerCase()
  if (type.includes('zahlung per debitkarte') || type.includes('zahlung an')) {
    return -block.amount
  }
  if (type.includes('zahlung von')) {
    return block.amount
  }
  // Currency exchange: if saldo went down, it's a debit in this section
  if (diff < 0) return -block.amount
  return block.amount
}

function extractCardNumber(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/^(xxxx\s+\d{4})\s*-?\s*$/)
    if (m) return m[1]
  }
  return null
}

function extractCounterpartyIban(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/^([A-Z]{2}\d{2}[\dA-Z]+)$/)
    if (m) return m[1]
  }
  return null
}

function extractExchangeInfo(
  lines: string[],
  typeLine: string,
): { rate: number | null; targetCurrency: string | null } {
  if (!typeLine.toLowerCase().includes('hrungsumtausch')) {
    return { rate: null, targetCurrency: null }
  }
  // Lines like: "CHF - EUR" and "1 CHF = 1.06373 EUR"
  for (const l of lines) {
    const m = l.match(/1\s+([A-Z]{3})\s*=\s*([\d.]+)\s+([A-Z]{3})/)
    if (m) {
      return { rate: parseFloat(m[2]), targetCurrency: m[3] }
    }
  }
  return { rate: null, targetCurrency: null }
}

function extractCounterpartyName(
  lines: string[],
  typeLine: string,
): { name: string | null; address: string | null } {
  // For card payments: skip the card line, next line is merchant name
  // For transfers: first middle line is the person/company name
  const isCard = typeLine.toLowerCase().includes('debitkarte')
  const isExchange = typeLine.toLowerCase().includes('hrungsumtausch')

  if (isExchange) return { name: null, address: null }

  const nameLines: string[] = []
  let skipNext = isCard // skip the "xxxx NNNN -" line for card payments

  for (const l of lines) {
    if (skipNext && /^xxxx\s+\d{4}/.test(l)) {
      skipNext = false
      continue
    }
    // Stop at IBAN lines or numeric-only lines (postal codes etc. that are part of address)
    if (/^[A-Z]{2}\d{2}[\dA-Z]+$/.test(l)) continue
    // Stop at lines that look like bank names for transfers
    if (/^[A-Z\s.]+(?:BANK|A\.G\.)/.test(l)) continue
    nameLines.push(l)
  }

  if (nameLines.length === 0) return { name: null, address: null }
  return {
    name: nameLines[0],
    address: nameLines.length > 1 ? nameLines.slice(1).join(', ') : null,
  }
}

function guessTransactionType(typeLine: string): string {
  const t = typeLine.toLowerCase()
  if (t.includes('zahlung per debitkarte')) return 'DEBIT_CARD'
  if (t.includes('zahlung von')) return 'CREDIT_TRANSFER'
  if (t.includes('zahlung an')) return 'BANK_TRANSFER'
  if (t.includes('hrungsumtausch')) return 'CURRENCY_EXCHANGE'
  return 'OTHER'
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export async function parseYuhPdf(buffer: ArrayBuffer): Promise<ParsedYuhPdf> {
  const data = await pdfParse(Buffer.from(buffer))
  const rawText = data.text
  const header = extractHeader(rawText)

  // Split into lines, strip boilerplate
  const allLines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean)
  const cleanLines = stripBoilerplate(allLines)

  // Split into currency sections
  const sections: { currency: string; lines: string[] }[] = []
  let currentSection: { currency: string; lines: string[] } | null = null

  for (const line of cleanLines) {
    const secMatch = SECTION_HEADER_RE.exec(line)
    if (secMatch) {
      if (currentSection) sections.push(currentSection)
      currentSection = { currency: secMatch[1], lines: [] }
      continue
    }
    if (currentSection) {
      currentSection.lines.push(line)
    }
  }
  if (currentSection) sections.push(currentSection)

  // Parse each section independently
  const transactions: YuhTransaction[] = []

  for (const section of sections) {
    const blocks = parseTransactionBlocks(section.lines, section.currency)

    // Get opening balance for sign determination
    // Look for "Saldo per DD.MM.YYYY amount" in the section lines
    let previousSaldo = 0
    const saldoMatch = section.lines.find((l) => l.startsWith('Saldo per'))
    if (saldoMatch) {
      const m = saldoMatch.match(/([\d'.-]+)\s+[A-Z]{3}$/)
      if (m) previousSaldo = parseSwissNumber(m[1])
    }

    for (const block of blocks) {
      const signedAmount = determineSign(block, previousSaldo)
      previousSaldo = block.saldo

      const card = extractCardNumber(block.middleLines)
      const iban = extractCounterpartyIban(block.middleLines)
      const { rate, targetCurrency } = extractExchangeInfo(block.middleLines, block.typeLine)
      const { name, address } = extractCounterpartyName(block.middleLines, block.typeLine)

      transactions.push({
        bookingDate: toIsoDate(block.bookingDate),
        valuteDate: toIsoDate(block.valutaDate),
        currency: section.currency,
        reference: block.reference,
        amount: signedAmount,
        balanceAfter: block.saldo,
        transactionType: block.typeLine,
        cardNumber: card,
        counterpartyName: name,
        counterpartyAddress: address,
        counterpartyIban: iban,
        exchangeRate: rate,
        exchangeTargetCurrency: targetCurrency,
        rawBlock: [
          `${block.bookingDate}${block.typeLine}`,
          ...block.middleLines,
          `${block.reference}${block.amount}${block.valutaDate}${block.saldo}`,
        ].join('\n'),
      })
    }
  }

  return { header, transactions }
}

// ---------------------------------------------------------------------------
// WIP mapping
// ---------------------------------------------------------------------------

export function toWipTransaction(
  tx: YuhTransaction,
  accountDocId: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    account: accountDocId,
    source_reference: tx.reference,
    booking_date: tx.bookingDate,
    currency: tx.currency,
    amount: tx.amount,
    transaction_type: guessTransactionType(tx.transactionType),
  }

  if (tx.valuteDate) data.value_date = tx.valuteDate
  if (tx.balanceAfter != null) data.balance_after = tx.balanceAfter
  if (tx.counterpartyName) data.counterparty_name = tx.counterpartyName
  if (tx.counterpartyAddress) data.counterparty_address = tx.counterpartyAddress
  if (tx.counterpartyIban) data.counterparty_iban = tx.counterpartyIban
  if (tx.cardNumber) data.card_number = tx.cardNumber
  if (tx.exchangeRate != null) data.exchange_rate = tx.exchangeRate
  if (tx.exchangeTargetCurrency) data.exchange_target_currency = tx.exchangeTargetCurrency
  if (tx.transactionType) data.description = tx.transactionType

  return data
}
