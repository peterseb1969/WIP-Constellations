import { extractPdfText } from './pdf-extract'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RochePayslipHeader {
  employeeName: string
  employeeNumber: string
  siNumber: string
  capacityPercent: number
  payDate: string        // YYYY-MM-DD
  period: string         // YYYY-MM
  periodLabel: string    // "November 2025"
  company: string
}

export interface RochePayslipLine {
  code: string           // "1001", "/101", "6103", etc.
  description: string
  amount: number         // always positive
  isDeduction: boolean   // trailing "-" in PDF
  basis: number | null
  rate: number | null    // percentage (5.30, not 0.053)
  category: string       // FIN_PAYSLIP_LINE_CATEGORY term value
}

export interface RochePayslipSummary {
  gross: number
  net: number
  paymentAmount: number
  totalSocialContributions: number
  totalPensionContributions: number
  totalDeductions: number
  currency: string
  targetIban: string
}

export interface ParsedRochePayslip {
  header: RochePayslipHeader
  lines: RochePayslipLine[]
  summary: RochePayslipSummary
}

// ---------------------------------------------------------------------------
// Category mapping — Roche payslip codes to FIN_PAYSLIP_LINE_CATEGORY
// ---------------------------------------------------------------------------

const CODE_TO_CATEGORY: Record<string, string> = {
  '1001': 'BASE_SALARY',
  '2003': 'ALLOWANCE',
  '2004': 'ALLOWANCE',
  '2005': 'ALLOWANCE',
  '2123': 'ALLOWANCE',
  '4103': 'BONUS',           // Applause Award Gross-up
  '4101': 'NON_CASH_BENEFIT', // Applause Award (non-cash)
  '4301': 'ESPP',            // Roche Connect EE
  '4311': 'NON_CASH_BENEFIT', // LTI tax/soc (NCB)
  '4313': 'LTI',             // LTI withholding
  '/411': 'SOCIAL_CONTRIBUTION',
  '/420': 'SOCIAL_CONTRIBUTION',
  '6103': 'PENSION',         // PF Capital savings plan
  '6104': 'PENSION',         // PF Pension insurance
  '6106': 'SUPPLEMENTARY_PENSION',
  '6108': 'VOLUNTARY_SAVING',
  '6109': 'VOLUNTARY_SAVING',
  '6201': 'BENEFIT_DEDUCTION', // Staff restaurant
}

function guessCategory(code: string, description: string): string {
  if (CODE_TO_CATEGORY[code]) return CODE_TO_CATEGORY[code]

  const desc = description.toLowerCase()
  if (desc.includes('salary') || desc.includes('gehalt')) return 'BASE_SALARY'
  if (desc.includes('allowance') || desc.includes('zulage')) return 'ALLOWANCE'
  if (desc.includes('bonus') || desc.includes('award')) return 'BONUS'
  if (desc.includes('ahv') || desc.includes('alv') || desc.includes('ui contribution')) return 'SOCIAL_CONTRIBUTION'
  if (desc.includes('pension') || desc.includes('pk ')) return 'PENSION'
  if (desc.includes('supplementary') || desc.includes('zusatz') || desc.includes('sps')) return 'SUPPLEMENTARY_PENSION'
  if (desc.includes('voluntary') || desc.includes('freiwillig')) return 'VOLUNTARY_SAVING'
  if (desc.includes('connect') || desc.includes('espp')) return 'ESPP'
  if (desc.includes('lti')) return 'LTI'
  if (desc.includes('restaurant') || desc.includes('staff')) return 'BENEFIT_DEDUCTION'
  return 'BENEFIT_DEDUCTION' // fallback for unknown deductions
}

// ---------------------------------------------------------------------------
// Month name mapping
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

function parsePeriod(label: string): string {
  // "November 2025" → "2025-11"
  const parts = label.trim().split(/\s+/)
  if (parts.length === 2) {
    const month = MONTH_NAMES[parts[0].toLowerCase()]
    if (month) return `${parts[1]}-${month}`
  }
  return label
}

// ---------------------------------------------------------------------------
// Number parsing — Roche uses comma as thousands sep, dot as decimal
// ---------------------------------------------------------------------------

function parseAmount(s: string): { value: number; isDeduction: boolean } {
  const trimmed = s.trim()
  const isDeduction = trimmed.endsWith('-')
  const clean = trimmed.replace(/-$/, '').replace(/,/g, '').trim()
  return { value: parseFloat(clean) || 0, isDeduction }
}

// ---------------------------------------------------------------------------
// Line parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single payslip line from the raw text.
 *
 * Observed patterns (pdfjs-dist output — space-separated):
 *   "1001 Monthly base salary 16,417.00"
 *   "/411 AHV contribution 16,457.00 5.30 % 872.20-"
 *   "2004 Child allowance 302.50 1 302.50"
 *   "4301 Roche Connect EE 1,641.00-"
 *
 * Code is either /NNN or NNNN at the start, followed by space.
 * Then description text, then numeric fields at the end.
 */

const LINE_RE = /^(\/?\d{3,4})\s+(.+)$/

function parseLine(raw: string): RochePayslipLine | null {
  const m = LINE_RE.exec(raw.trim())
  if (!m) return null

  const code = m[1]
  const rest = m[2]

  // Extract all numbers from the end of the line
  // Numbers look like: 16,457.00 or 5.30 or 872.20-
  // We work from right to left
  const amounts: string[] = []
  let remaining = rest.trim()

  // Pull amounts from right side — pattern: optional minus, digits with commas, dot, 2 decimals, optional trailing minus
  // Also handle percentage: "5.30 %"
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Try percentage first: "5.30 %"
    const pctMatch = remaining.match(/\s+([\d,.]+)\s+%\s*$/)
    if (pctMatch) {
      amounts.unshift(pctMatch[1] + ' %')
      remaining = remaining.slice(0, remaining.length - pctMatch[0].length)
      continue
    }

    // Try amount (with optional trailing minus): "16,417.00" or "872.20-"
    const amtMatch = remaining.match(/\s+([\d,]+\.\d{2}-?)\s*$/)
    if (amtMatch) {
      amounts.unshift(amtMatch[1])
      remaining = remaining.slice(0, remaining.length - amtMatch[0].length)
      continue
    }

    // Try integer (unit count): "    1 " between amounts
    const intMatch = remaining.match(/\s+(\d+)\s*$/)
    if (intMatch && amounts.length > 0) {
      // This is a unit count — skip it (it's between basis and amount)
      remaining = remaining.slice(0, remaining.length - intMatch[0].length)
      continue
    }

    break
  }

  const description = remaining.trim()

  // Determine the final amount (always the last numeric field)
  let amount = 0
  let isDeduction = false
  let basis: number | null = null
  let rate: number | null = null

  if (amounts.length === 0) return null

  // Last amount is the line amount
  const lastAmt = amounts[amounts.length - 1]
  const parsed = parseAmount(lastAmt)
  amount = parsed.value
  isDeduction = parsed.isDeduction

  // Check for basis and rate in earlier amounts
  for (let i = 0; i < amounts.length - 1; i++) {
    const a = amounts[i]
    if (a.endsWith('%')) {
      rate = parseFloat(a.replace(/[,%]/g, '').trim())
    } else {
      const p = parseAmount(a)
      basis = p.value
    }
  }

  return {
    code,
    description,
    amount,
    isDeduction,
    basis,
    rate,
    category: guessCategory(code, description),
  }
}

// ---------------------------------------------------------------------------
// Header extraction
// ---------------------------------------------------------------------------

function extractHeader(englishText: string): RochePayslipHeader {
  const empMatch = englishText.match(/Employee Nr\.\s*(\d+)/)
  const siMatch = englishText.match(/SI Number\n([\d.]+)/)
  const capMatch = englishText.match(/(\d+)%/)
  const payDateMatch = englishText.match(/Pay date\s*(\d{2}\.\d{2}\.\d{4})/)
  const periodMatch = englishText.match(/(\w+ \d{4})Pay period/)
  const companyMatch = englishText.match(/(.+?)Company/)
  const nameMatch = englishText.match(/(?:Mr|Mrs|Ms)\s*\n(.+?)\n/)

  const payDateRaw = payDateMatch?.[1] ?? ''
  const [dd, mm, yyyy] = payDateRaw.split('.')

  return {
    employeeName: nameMatch?.[1]?.trim() ?? '',
    employeeNumber: empMatch?.[1] ?? '',
    siNumber: siMatch?.[1] ?? '',
    capacityPercent: capMatch ? parseInt(capMatch[1], 10) : 100,
    payDate: yyyy ? `${yyyy}-${mm}-${dd}` : '',
    period: periodMatch ? parsePeriod(periodMatch[1]) : '',
    periodLabel: periodMatch?.[1]?.trim() ?? '',
    company: companyMatch?.[1]?.trim() ?? '',
  }
}

// ---------------------------------------------------------------------------
// Summary extraction
// ---------------------------------------------------------------------------

function extractSummary(
  lines: RochePayslipLine[],
  englishText: string,
): RochePayslipSummary {
  const gross = lines.find((l) => l.code === '/101')?.amount ?? 0
  const net = lines.find((l) => l.code === '/550')?.amount ?? 0
  const totalDeductions = lines.find((l) => l.code === '/110')?.amount ?? 0

  // Payment amount line
  const paymentMatch = englishText.match(/Payment Amount\s+([\d,]+\.\d{2})/)
  const paymentAmount = paymentMatch ? parseFloat(paymentMatch[1].replace(/,/g, '')) : 0

  // Social contributions: /411 + /420
  const socialLines = lines.filter((l) => ['/411', '/420'].includes(l.code))
  const totalSocial = socialLines.reduce((sum, l) => sum + l.amount, 0)

  // Pension: 6103 + 6104
  const pensionLines = lines.filter((l) => ['6103', '6104'].includes(l.code))
  const totalPension = pensionLines.reduce((sum, l) => sum + l.amount, 0)

  // Currency + IBAN from bank details
  const bankMatch = englishText.match(/(CH\w+)\s+([\d,]+\.\d{2})\s+(CHF|EUR|USD)/)

  return {
    gross,
    net,
    paymentAmount,
    totalSocialContributions: totalSocial,
    totalPensionContributions: totalPension,
    totalDeductions,
    currency: bankMatch?.[3] ?? 'CHF',
    targetIban: bankMatch?.[1] ?? '',
  }
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export async function parseRochePayslip(buffer: ArrayBuffer): Promise<ParsedRochePayslip> {
  const data = await extractPdfText(buffer)
  const rawText = data.text

  // Split English / German — German starts with "Herr" or "Frau" after the English section
  // pdfjs-dist puts "Herr" on its own line
  const germanStart = rawText.search(/\n(?:Herr|Frau)\s*\n/)
  const englishText = germanStart > 0 ? rawText.substring(0, germanStart) : rawText

  const header = extractHeader(englishText)

  // Parse line items from the Earnings section
  const textLines = englishText.split('\n')
  const lines: RochePayslipLine[] = []
  let inEarnings = false
  let inNonCash = false

  for (const line of textLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Section markers
    if (trimmed === 'Earnings' || trimmed.startsWith('Code Text') || trimmed.startsWith('CodeText')) {
      inEarnings = true
      inNonCash = false
      continue
    }
    if (trimmed.startsWith('Non-cash Benefits')) {
      inNonCash = true
      inEarnings = false
      continue
    }
    if (trimmed.startsWith('TextCode') || trimmed.startsWith('Text Code') || trimmed.startsWith('Bank Details') || trimmed.startsWith('Message')) {
      // Non-cash header row or bank section — skip header, keep parsing non-cash items
      if (trimmed.startsWith('Bank Details') || trimmed.startsWith('Message')) {
        inNonCash = false
        inEarnings = false
      }
      continue
    }
    if (trimmed.startsWith('Payment Amount') || trimmed.startsWith('Bank Key')) {
      inEarnings = false
      continue
    }

    if (!inEarnings && !inNonCash) continue

    // Try to parse as a line item
    const parsed = parseLine(trimmed)
    if (parsed) {
      if (inNonCash) {
        parsed.category = 'NON_CASH_BENEFIT'
      }
      lines.push(parsed)
    }
  }

  const summary = extractSummary(lines, englishText)

  // Filter out subtotal lines — their values are in the summary
  const SUBTOTAL_CODES = new Set(['/101', '/550', '/110'])
  const filteredLines = lines.filter((l) => !SUBTOTAL_CODES.has(l.code))

  return { header, lines: filteredLines, summary }
}

// ---------------------------------------------------------------------------
// WIP mapping — FIN_PAYSLIP
// ---------------------------------------------------------------------------

export function toWipPayslip(
  parsed: ParsedRochePayslip,
  employerDocId: string,
): Record<string, unknown> {
  return {
    employer: employerDocId,
    period: parsed.header.period,
    pay_date: parsed.header.payDate,
    currency: parsed.summary.currency,
    gross: parsed.summary.gross,
    net: parsed.summary.net,
    payment_amount: parsed.summary.paymentAmount,
    total_social_contributions: parsed.summary.totalSocialContributions,
    total_pension_contributions: parsed.summary.totalPensionContributions,
    total_deductions: parsed.summary.totalDeductions,
    employee_number: parsed.header.employeeNumber,
    capacity_utilization: parsed.header.capacityPercent,
    target_iban: parsed.summary.targetIban,
  }
}

// ---------------------------------------------------------------------------
// WIP mapping — FIN_PAYSLIP_LINE
// ---------------------------------------------------------------------------

export function toWipPayslipLine(
  line: RochePayslipLine,
  payslipDocId: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    payslip: payslipDocId,
    code: line.code,
    description: line.description,
    category: line.category,
    amount: line.amount,
    is_deduction: line.isDeduction,
  }
  if (line.basis != null) data.basis = line.basis
  if (line.rate != null) data.rate = line.rate
  return data
}
