/**
 * Parser for Roche payslip PDFs.
 *
 * After PDF text extraction, the English page produces lines like:
 *
 *   Mr   Company   F. Hoffmann-La Roche AG
 *   Employee Nr. 10311897
 *   Pay period   November 2025
 *   Pay date   25.11.2025
 *   Capacity util 100%
 *   1001 Monthly base salary   16,417.00
 *   1001 Monthly base salary   16,417.00 4311 LTI tax/soc (NCB)   8,828.40
 *   /101 GROSS   17,287.00
 *   /411 AHV contribution   23,957.50 5.30 %   1,269.75-
 *   /550 NET   15,881.40
 *   /110 PAYMENTS/DEDUCTIONS   3,426.05-
 *   Payment Amount   12,758.72
 *   00293   UBS SWITZERLAND AG   CH790029329382280140A   12,758.72 CHF
 *
 * Key challenges:
 * - Two-column lines: left = earnings, right = non-cash benefits (both start with 4-digit code)
 * - Social contribution lines (/411, /420, /425) have basis, rate%, and amount-
 * - Deductions indicated by trailing dash on the amount
 * - German duplicate page follows after --- PAGE BREAK ---
 */

export interface PayslipData {
  employeeNumber: string
  period: string       // YYYY-MM
  payDate: string      // YYYY-MM-DD
  currency: string
  gross: number
  net: number
  paymentAmount: number
  totalSocialContributions: number
  totalPensionContributions: number
  totalDeductions: number
  capacityUtilization: number | null
  targetIban: string
  lines: PayslipLine[]
}

export interface PayslipLine {
  code: string
  description: string
  category: string
  amount: number
  basis: number | null
  rate: number | null
  isDeduction: boolean
}

const MONTH_MAP: Record<string, string> = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12',
  'januar': '01', 'februar': '02', 'märz': '03', 'marz': '03',
  'mai': '05', 'juni': '06', 'juli': '07',
  'oktober': '10', 'dezember': '12',
}

const CODE_TO_CATEGORY: Record<string, string> = {
  '1001': 'BASE_SALARY',
  '2003': 'ALLOWANCE', '2004': 'ALLOWANCE', '2005': 'ALLOWANCE',
  '2123': 'ALLOWANCE',
  '4103': 'BONUS',
  '4301': 'ESPP',
  '4311': 'NON_CASH_BENEFIT', '4318': 'NON_CASH_BENEFIT',
  '4313': 'LTI',
  '6103': 'PENSION', '6104': 'PENSION',
  '6106': 'SUPPLEMENTARY_PENSION', '6109': 'SUPPLEMENTARY_PENSION',
  '6108': 'VOLUNTARY_SAVING',
  '6201': 'BENEFIT_DEDUCTION',
}

function categorizeCode(code: string): string {
  if (CODE_TO_CATEGORY[code]) return CODE_TO_CATEGORY[code]!
  const prefix = code.substring(0, 1)
  switch (prefix) {
    case '1': return 'BASE_SALARY'
    case '2': return 'ALLOWANCE'
    case '3': return 'BONUS'
    case '4': return 'OTHER'
    case '5': return 'BENEFIT_DEDUCTION'
    case '6': return 'PENSION'
    default: return 'OTHER'
  }
}

/** Parse a Swiss-formatted number like "16,417.00" or "1,269.75-" (trailing dash = negative). */
function parsePayslipNumber(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '')
  if (cleaned.endsWith('-')) {
    return -Math.abs(Number(cleaned.slice(0, -1)))
  }
  return Number(cleaned)
}

/**
 * Check if a line signals the start of the German duplicate page.
 * We stop parsing when we hit this.
 */
function isGermanPageStart(line: string): boolean {
  if (/^Herr\s/.test(line) && line.includes('Firma')) return true
  if (line.includes('Verdienste')) return true
  if (line.includes('Beschreibung')) return true
  return false
}

/**
 * Try to split a line that contains two entries side-by-side:
 *   "1001 Monthly base salary   16,417.00 4311 LTI tax/soc (NCB)   8,828.40"
 *
 * The right-side entry starts with a 4-digit code that appears after an amount.
 * We look for the pattern: amount followed by whitespace and a 4-digit code.
 */
function splitDualColumnLine(line: string): [string, string | null] {
  // Match: a number (with optional trailing dash) followed by spaces and a 4-digit code
  // The 4-digit code must be followed by a space and text (not just end of line)
  const dualMatch = line.match(
    /^(\d{4}\s.+?\d+\.\d{2}-?)\s{2,}(\d{4}\s.+)$/
  )
  if (dualMatch) {
    return [dualMatch[1]!, dualMatch[2]!]
  }
  return [line, null]
}

/**
 * Parse a single line item segment like:
 *   "1001 Monthly base salary   16,417.00"
 *   "2004 Child allowance   302.50 1   302.50"
 *   "4301 Roche Connect EE   1,641.00-"
 *   "4313 LTI withholding   565.02"
 *
 * For allowance lines with count+amount (e.g., "302.50 1   302.50"),
 * the last number is the actual amount.
 */
function parseLineItem(segment: string, categoryOverride?: string): PayslipLine | null {
  const match = segment.match(/^(\d{4})\s+(.+)/)
  if (!match) return null

  const code = match[1]!
  const rest = match[2]!

  // Find all number tokens (Swiss format: "16,417.00" or "1,641.00-")
  const numberPattern = /[\d,]+\.\d{2}-?/g
  const numbers: { value: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = numberPattern.exec(rest)) !== null) {
    numbers.push({ value: m[0], index: m.index })
  }

  if (numbers.length === 0) return null

  // The last number is always the amount
  const rawAmount = numbers[numbers.length - 1]!.value
  const amount = parsePayslipNumber(rawAmount)
  const isDeduction = rawAmount.endsWith('-')

  // Description is the text before the first number, cleaned up
  const firstNumPos = numbers[0]!.index
  let description = rest.substring(0, firstNumPos).trim()
  description = description.replace(/\s{2,}/g, ' ').trim()

  const category = categoryOverride ?? categorizeCode(code)

  return {
    code,
    description,
    category,
    amount: Math.abs(amount),
    basis: null,
    rate: null,
    isDeduction,
  }
}

/**
 * Parse a social contribution line like:
 *   "/411 AHV contribution   16,457.00 5.30 %   872.20-"
 *   "/420 UI contribution   12,350.00 1.10 %   135.85-"
 *   "/425 UIA supplementary cont   136,050.00 0.50 %   680.25-"
 */
function parseSocialContributionLine(line: string): PayslipLine | null {
  // Pattern: /NNN description   basis rate %   amount-
  // No $ anchor — there may be trailing whitespace or other content
  const match = line.match(
    /^\/(\d{3})\s+(.+?)\s{2,}([\d,]+\.\d{2})\s+([\d.]+)\s*%\s+([\d,]+\.\d{2}-?)/
  )
  if (!match) return null

  const code = `/${match[1]!}`
  const description = match[2]!.trim()
  const basis = parsePayslipNumber(match[3]!)
  const rate = Number(match[4]!)
  const rawAmount = match[5]!
  const amount = parsePayslipNumber(rawAmount)

  return {
    code,
    description,
    category: 'SOCIAL_CONTRIBUTION',
    amount: Math.abs(amount),
    basis,
    rate,
    isDeduction: true,
  }
}

export function parsePayslipPdfText(fullText: string): PayslipData {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  let employeeNumber = ''
  let period = ''
  let payDate = ''
  const currency = 'CHF'
  let gross = 0
  let net = 0
  let paymentAmount = 0
  let capacityUtilization: number | null = null
  let targetIban = ''
  const payslipLines: PayslipLine[] = []

  let totalSocial = 0
  let totalPension = 0
  let totalDeductions = 0

  for (const line of lines) {
    // Stop at German page or page break
    if (isGermanPageStart(line)) break
    if (line.includes('PAGE BREAK')) break

    // --- Header fields ---

    // Employee Nr. 10311897
    const empMatch = line.match(/Employee\s+Nr\.?\s+(\d{7,8})/i)
    if (empMatch) {
      employeeNumber = empMatch[1]!
      continue
    }

    // Capacity util 100%
    const capMatch = line.match(/Capacity\s+util\.?\s+(\d+)\s*%/i)
    if (capMatch) {
      capacityUtilization = Number(capMatch[1]!)
      continue
    }

    // Pay period   November 2025
    const periodMatch = line.match(/Pay\s+period\s+(\w+)\s+(\d{4})/i)
    if (periodMatch) {
      const monthName = periodMatch[1]!.toLowerCase()
      const year = periodMatch[2]!
      const month = MONTH_MAP[monthName]
      if (month) period = `${year}-${month}`
      continue
    }

    // Pay date   25.11.2025
    const payDateMatch = line.match(/Pay\s+date\s+(\d{2})\.(\d{2})\.(\d{4})/i)
    if (payDateMatch) {
      payDate = `${payDateMatch[3]!}-${payDateMatch[2]!}-${payDateMatch[1]!}`
      continue
    }

    // --- Subtotal / summary lines ---

    // /101 GROSS   17,247.00
    const grossMatch = line.match(/^\/101\s+(?:GROSS|BRUTTO)\s+([\d,]+\.\d{2})/)
    if (grossMatch) {
      gross = parsePayslipNumber(grossMatch[1]!)
      continue
    }

    // /550 NET   16,238.95
    const netMatch = line.match(/^\/550\s+(?:NET|NETTO)\s+([\d,]+\.\d{2})/)
    if (netMatch) {
      net = parsePayslipNumber(netMatch[1]!)
      continue
    }

    // /110 PAYMENTS/DEDUCTIONS   3,426.05-  or  /110 BEZÜGE/ABZ ÜGE   3,426.05-
    const dedMatch = line.match(/^\/110\s+.+?([\d,]+\.\d{2}-?)/)
    if (dedMatch) {
      totalDeductions = Math.abs(parsePayslipNumber(dedMatch[1]!))
      continue
    }

    // Social contribution lines: /411, /420, /425
    if (/^\/4\d{2}\s/.test(line)) {
      const socialLine = parseSocialContributionLine(line)
      if (socialLine) {
        totalSocial += socialLine.amount
        payslipLines.push(socialLine)
        continue
      }
    }

    // Payment Amount   12,812.90
    const payAmtMatch = line.match(/Payment\s+Amount\s+([\d,]+\.\d{2})/)
    if (payAmtMatch) {
      paymentAmount = parsePayslipNumber(payAmtMatch[1]!)
      continue
    }

    // IBAN in bank details line: CH790029329382280140A
    const ibanMatch = line.match(/\b(CH\w{19,21})\b/i)
    if (ibanMatch) {
      targetIban = ibanMatch[1]!
      // Also try to pick up payment amount from bank line if not yet found
      if (!paymentAmount) {
        const bankAmtMatch = line.match(/([\d,]+\.\d{2})\s+CHF\s*$/)
        if (bankAmtMatch) paymentAmount = parsePayslipNumber(bankAmtMatch[1]!)
      }
      continue
    }

    // --- Line items (4-digit code) ---
    if (/^\d{4}\s/.test(line)) {
      const [leftSegment, rightSegment] = splitDualColumnLine(line)

      const leftItem = parseLineItem(leftSegment)
      if (leftItem) {
        updateTotals(leftItem)
        payslipLines.push(leftItem)
      }

      if (rightSegment) {
        // Right-side items are non-cash benefits/declarations
        const rightItem = parseLineItem(rightSegment, 'NON_CASH_BENEFIT')
        if (rightItem) {
          updateTotals(rightItem)
          payslipLines.push(rightItem)
        }
      }
    }
  }

  // Fallback: derive payment amount from NET minus deductions
  if (!paymentAmount && net > 0 && totalDeductions > 0) {
    paymentAmount = net - totalDeductions
  }

  // Fallback pay date: assume 25th of the period month
  if (!payDate && period) {
    payDate = `${period}-25`
  }

  return {
    employeeNumber,
    period,
    payDate,
    currency,
    gross,
    net,
    paymentAmount,
    totalSocialContributions: totalSocial,
    totalPensionContributions: totalPension,
    totalDeductions,
    capacityUtilization,
    targetIban,
    lines: payslipLines,
  }

  function updateTotals(item: PayslipLine): void {
    if (item.category === 'PENSION' || item.category === 'SUPPLEMENTARY_PENSION' || item.category === 'VOLUNTARY_SAVING') {
      totalPension += item.amount
    }
  }
}
