/**
 * Parser for Yuh (Swissquote) PDF bank statements.
 *
 * Key discovery: in the extracted PDF text, dates are GLUED to the following
 * text with no space:
 *   06.01.2026Zahlung per Debitkarte   1016223355 151.00   06.01.2026   1'116.51
 *
 * References (9-10 digit numbers) can also be glued to the preceding text or
 * to the amount that follows:
 *   09.01.2026Zahlung per Debitkarte   1018189421559.90   09.01.2026   2'256.61
 *   30.01.2026Automatisierter Währungstausch1030992381 70.88   03.02.2026   3'370.64
 *
 * Detail lines follow until the next transaction or section marker.
 *
 * Currency sections are delimited by "Kontoauszug in CHF/EUR/USD".
 * Credit vs debit for currency exchanges is determined by the exchange detail
 * line ("CHF - EUR") in context of the current currency section.
 */

export interface YuhTransaction {
  sourceReference: string
  bookingDate: string      // YYYY-MM-DD
  valueDate: string        // YYYY-MM-DD
  currency: string
  amount: number           // positive for credit, negative for debit
  balance: number | null
  transactionType: string
  description: string
  counterpartyName: string
}

// ---- Internal helpers ----

const SKIP_PREFIXES = [
  'Anfangsbestand', 'Schlussbilanz', 'DATUM', 'Saldo per', 'Total ',
  'Herrn', 'IBAN', 'Seite', 'Dokument', 'Vom ', 'Die vorliegende',
  'Bescheid', 'Swissquote',
]

const SKIP_CONTAINS = ['PAGE BREAK', '©2022']

function shouldSkipLine(line: string): boolean {
  for (const prefix of SKIP_PREFIXES) {
    if (line.startsWith(prefix)) return true
  }
  for (const fragment of SKIP_CONTAINS) {
    if (line.includes(fragment)) return true
  }
  return false
}

type TxTypeKey =
  | 'DEBIT_CARD'
  | 'CURRENCY_EXCHANGE'
  | 'BANK_TRANSFER_IN'
  | 'BANK_TRANSFER_OUT'
  | 'OTHER'
  | '_SKIP'

const TYPE_KEYWORDS: [string, TxTypeKey][] = [
  ['zahlung per debitkarte', 'DEBIT_CARD'],
  ['automatisierter währungstausch', 'CURRENCY_EXCHANGE'],
  ['automatisierter wahrungstausch', 'CURRENCY_EXCHANGE'],
  ['währungsumtausch', 'CURRENCY_EXCHANGE'],
  ['wahrungsumtausch', 'CURRENCY_EXCHANGE'],
  ['zahlung von', 'BANK_TRANSFER_IN'],
  ['zahlung an', 'BANK_TRANSFER_OUT'],
  ['anfangsbestand', '_SKIP'],
  ['schlussbilanz', '_SKIP'],
]

function detectTransactionType(text: string): TxTypeKey {
  const lower = text.toLowerCase()
  for (const [keyword, type] of TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return type
  }
  return 'OTHER'
}

function parseSwissDate(value: string): string {
  const parts = value.split('.')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return value
}

function parseSwissNumber(value: string): number {
  if (!value || value.trim() === '') return 0
  return Number(value.replace(/'/g, ''))
}

/**
 * Date pattern at the start of a line: DD.MM.YYYY immediately followed by text
 * (no space required).
 */
const TX_LINE_REGEX = /^(\d{2}\.\d{2}\.\d{4})(.+)/

/**
 * Matches a 9-10 digit reference number. The reference may be glued to
 * preceding text AND to a following amount, e.g. "1018189421559.90"
 * where "1018189421" is the reference and "559.90" is the amount.
 *
 * Strategy: find all digit sequences of 9+ digits. If the sequence is
 * followed by a decimal amount (like "559.90"), split it so the last
 * digits + ".XX" form the amount.
 */
function extractReferenceAndCleanRest(rest: string): {
  reference: string
  cleaned: string
} {
  // Look for a 9-10 digit number that might be glued to surrounding text.
  // It could appear as:
  //   "1016223355 151.00"     — reference standalone, amount separate
  //   "1018189421559.90"      — reference glued to amount (ref=1018189421, amt=559.90)
  //   "Währungstausch1030992381 70.88" — reference glued to preceding text

  // First, try to find a clean 9-10 digit reference (word-boundary or surrounded by spaces/text)
  // We'll scan for long digit sequences and figure out where the reference ends.

  // Pattern: a run of digits that is at least 9 chars long, possibly followed by
  // more digits, a dot, and 2 decimal digits (glued amount).
  const longDigitRun = /(\d{9,})(\.\d{2})?/g
  let match: RegExpExecArray | null
  let reference = ''
  let cleaned = rest

  while ((match = longDigitRun.exec(rest)) !== null) {
    const fullDigits = match[1]!
    const decimalPart = match[2] // e.g., ".90"

    if (decimalPart && fullDigits.length > 10) {
      // Something like "1018189421559.90" — the digits are too long for just a reference.
      // Split: first 9 or 10 digits are reference, remainder + decimal = amount.
      // Try 10 first, then 9.
      const ref10 = fullDigits.substring(0, 10)
      const amountStr10 = fullDigits.substring(10) + decimalPart

      const ref9 = fullDigits.substring(0, 9)
      const amountStr9 = fullDigits.substring(9) + decimalPart

      // Pick 10-digit ref if the remaining amount parses sensibly (non-zero, < 1M)
      const amt10 = parseSwissNumber(amountStr10)
      const amt9 = parseSwissNumber(amountStr9)

      if (amt10 > 0 && amt10 < 1_000_000 && amountStr10.match(/^\d{1,6}\.\d{2}$/)) {
        reference = ref10
        // Replace the glued mess with separated tokens
        cleaned = cleaned.replace(match[0], `${ref10} ${amountStr10}`)
      } else if (amt9 > 0 && amt9 < 1_000_000 && amountStr9.match(/^\d{1,6}\.\d{2}$/)) {
        reference = ref9
        cleaned = cleaned.replace(match[0], `${ref9} ${amountStr9}`)
      }
      break
    } else if (fullDigits.length >= 9 && fullDigits.length <= 10) {
      // Clean reference, 9-10 digits
      reference = fullDigits
      break
    } else if (fullDigits.length > 10 && !decimalPart) {
      // Long digit run without decimal — take first 10 as reference
      reference = fullDigits.substring(0, 10)
      const leftover = fullDigits.substring(10)
      cleaned = cleaned.replace(match[0], `${reference} ${leftover}`)
      break
    }
  }

  return { reference, cleaned }
}

/**
 * Determine if a currency exchange is a credit or debit based on the
 * exchange detail lines and the current currency section.
 *
 * If the detail says "CHF - EUR" and we're in the CHF section, money is
 * leaving (debit). If we're in the EUR section, money is arriving (credit).
 *
 * If the detail says "EUR - CHF" and we're in the CHF section, money is
 * arriving (credit). Etc.
 */
function isCurrencyExchangeCredit(
  detailLines: string[],
  currentCurrency: string,
): boolean {
  for (const dl of detailLines) {
    const exchangeMatch = dl.match(/^([A-Z]{3})\s*-\s*([A-Z]{3})$/)
    if (exchangeMatch) {
      const fromCcy = exchangeMatch[1]!
      const toCcy = exchangeMatch[2]!
      // If we're in the "to" currency section, it's a credit (money arriving)
      if (currentCurrency === toCcy) return true
      // If we're in the "from" currency section, it's a debit (money leaving)
      if (currentCurrency === fromCcy) return false
    }
  }
  // Fallback: treat as debit
  return false
}

function isNextTransactionOrSection(line: string): boolean {
  if (TX_LINE_REGEX.test(line)) return true
  if (line.match(/^Kontoauszug in /)) return true
  if (line.startsWith('DATUM')) return true
  if (line.startsWith('Saldo per')) return true
  if (line.startsWith('Total ')) return true
  if (line.includes('PAGE BREAK')) return true
  if (line.startsWith('Anfangsbestand')) return true
  if (line.startsWith('Schlussbilanz')) return true
  return false
}

// ---- Main parser ----

export function parseYuhPdfText(fullText: string): {
  iban: string
  transactions: YuhTransaction[]
} {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  // Extract IBAN — look for CH followed by digits (possibly with spaces)
  let iban = ''
  for (const line of lines) {
    const ibanMatch = line.match(/\b(CH\d[\d\s]{15,30}\d)\b/)
    if (ibanMatch) {
      iban = ibanMatch[1]!.replace(/\s/g, '')
      break
    }
  }

  let currentCurrency = 'CHF'
  const transactions: YuhTransaction[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    // Currency section header
    const ccyMatch = line.match(/^Kontoauszug in (\w+)/)
    if (ccyMatch) {
      currentCurrency = ccyMatch[1]!
      i++
      continue
    }

    // Skip known non-transaction lines
    if (shouldSkipLine(line)) {
      i++
      continue
    }

    // Try to match a transaction line: date glued to text
    const txMatch = line.match(TX_LINE_REGEX)
    if (!txMatch) {
      i++
      continue
    }

    const bookingDateRaw = txMatch[1]!
    const rawRest = txMatch[2]!

    // Detect transaction type from the text portion
    const txType = detectTransactionType(rawRest)

    if (txType === '_SKIP') {
      i++
      continue
    }

    // Extract reference (9-10 digits) and clean up glued amounts
    const { reference, cleaned } = extractReferenceAndCleanRest(rawRest)

    // Extract all Swiss-format numbers from the cleaned rest
    // Swiss numbers: optional apostrophe thousands, dot decimal: 1'234.56 or 559.90
    const numberPattern = /[\d']+\.\d{2}/g
    const numbers: string[] = []
    let nm: RegExpExecArray | null
    while ((nm = numberPattern.exec(cleaned)) !== null) {
      numbers.push(nm[0])
    }

    // Extract valuta date (DD.MM.YYYY appearing after the transaction text)
    // The second date on the line (after the leading booking date)
    const valutaMatch = cleaned.match(/(\d{2}\.\d{2}\.\d{4})/)
    const valueDateRaw = valutaMatch ? valutaMatch[1]! : bookingDateRaw

    // Gather detail lines until next transaction or section marker
    const detailLines: string[] = []
    let j = i + 1
    while (j < lines.length) {
      const nextLine = lines[j]!
      if (isNextTransactionOrSection(nextLine)) break
      if (shouldSkipLine(nextLine)) break
      detailLines.push(nextLine)
      j++
    }

    // Determine amount and balance from extracted numbers.
    // Layout: [AMOUNT] [VALUTA_DATE] [BALANCE]
    // Sometimes both debit and credit columns are present but one is empty.
    // In extracted text we get: amount(s), then valuta date is text, then balance.
    // After removing the valuta date match, the numbers are:
    //   - If 2 numbers: [amount, balance]
    //   - If 1 number: [amount] (no balance)
    //   - If 3+ numbers: unusual, take first as amount, last as balance

    let amountRaw = 0
    let balance: number | null = null

    if (numbers.length >= 2) {
      amountRaw = parseSwissNumber(numbers[0]!)
      balance = parseSwissNumber(numbers[numbers.length - 1]!)
    } else if (numbers.length === 1) {
      amountRaw = parseSwissNumber(numbers[0]!)
    }

    // Determine sign: positive = credit, negative = debit
    let isCredit: boolean
    switch (txType) {
      case 'BANK_TRANSFER_IN':
        isCredit = true
        break
      case 'DEBIT_CARD':
      case 'BANK_TRANSFER_OUT':
        isCredit = false
        break
      case 'CURRENCY_EXCHANGE':
        isCredit = isCurrencyExchangeCredit(detailLines, currentCurrency)
        break
      default:
        // For OTHER, try to guess from column position.
        // If we have 3 numbers before the date, the middle might indicate credit.
        // Fallback: treat as debit.
        isCredit = false
        break
    }

    const amount = isCredit ? amountRaw : -amountRaw

    // Extract counterparty name from detail lines.
    // Skip: card mask lines ("xxxx ..."), exchange rate lines ("CHF - EUR", "1 CHF = ..."),
    // IBAN lines ("CH..."), numeric-prefixed lines.
    let counterpartyName = ''
    for (const dl of detailLines) {
      if (dl.startsWith('xxxx')) continue
      if (dl.match(/^[A-Z]{3}\s*-\s*[A-Z]{3}$/)) continue
      if (dl.match(/^1\s+[A-Z]{3}\s*=/)) continue
      if (dl.match(/^CH\d/)) continue
      if (dl.match(/^\d{4}\s+\d/)) continue
      // Skip lines that look like pure amounts/numbers
      if (dl.match(/^[\d']+\.\d{2}$/)) continue
      // Skip lines starting with "Rechnung:" or similar metadata
      if (dl.match(/^Rechnung:/)) continue
      if (dl.length > 2) {
        counterpartyName = dl
        break
      }
    }

    // Build description: transaction text + detail lines
    // Extract the text portion (before reference and numbers) from the raw rest
    let descriptionBase = rawRest
    // Remove the reference and everything after it for a cleaner description text
    if (reference) {
      const refIdx = rawRest.indexOf(reference)
      if (refIdx > 0) {
        descriptionBase = rawRest.substring(0, refIdx).trim()
      }
    }
    const description = [descriptionBase, ...detailLines]
      .filter(Boolean)
      .join(' | ')
      .substring(0, 200)

    if (reference) {
      transactions.push({
        sourceReference: reference,
        bookingDate: parseSwissDate(bookingDateRaw),
        valueDate: parseSwissDate(valueDateRaw),
        currency: currentCurrency,
        amount,
        balance,
        transactionType: txType,
        description,
        counterpartyName,
      })
    }

    i = j
    continue
  }

  return { iban, transactions }
}
