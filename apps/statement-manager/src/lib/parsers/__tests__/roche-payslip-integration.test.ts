import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock pdf-extract to use the pdfjs-dist legacy build (Node-compatible)
vi.mock('../pdf-extract', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any

  interface TextItem { str: string; transform: number[] }

  async function extractPdfText(buffer: ArrayBuffer): Promise<{ text: string; numPages: number }> {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const allLines: string[] = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      let lastY: number | null = null
      let lineText = ''
      for (const item of content.items) {
        const ti = item as TextItem
        if (ti.str === undefined) continue
        const y = ti.transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          allLines.push(lineText)
          lineText = ''
        }
        lineText += ti.str
        lastY = y
      }
      if (lineText) allLines.push(lineText)
    }
    return { text: allLines.join('\n'), numPages: pdf.numPages }
  }

  return { extractPdfText }
})

import { parseRochePayslip, toWipPayslip, toWipPayslipLine } from '../roche-payslip'

const DATA_DIR = path.resolve(__dirname, '../../../../../../realworlddata')

const payslipFiles = [
  'PAYSLIP_RCH_CH002_CH_Y2025_P11_E10311897_R01.pdf',
  'PAYSLIP_RCH_CH002_CH_Y2025_P12_E10311897_R01.pdf',
  'PAYSLIP_RCH_CH002_CH_Y2026_P01_E10311897_R01.pdf',
  'PAYSLIP_RCH_CH002_CH_Y2026_P02_E10311897_R01.pdf',
]

const hasRealData = payslipFiles.some((f) => fs.existsSync(path.join(DATA_DIR, f)))

describe.skipIf(!hasRealData)('Roche payslip integration — real files', () => {
  for (const file of payslipFiles) {
    const filePath = path.join(DATA_DIR, file)
    if (!fs.existsSync(filePath)) continue

    describe(file, () => {
      let result: Awaited<ReturnType<typeof parseRochePayslip>>

      beforeAll(async () => {
        const buf = fs.readFileSync(filePath)
        result = await parseRochePayslip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      })

      it('extracts header with employee number and pay date', () => {
        expect(result.header.employeeNumber).toMatch(/^\d+$/)
        expect(result.header.payDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.header.period).toMatch(/^\d{4}-\d{2}$/)
        expect(result.header.capacityPercent).toBeGreaterThan(0)
      })

      it('extracts line items', () => {
        expect(result.lines.length).toBeGreaterThan(0)
      })

      it('every line has required fields', () => {
        const validCategories = [
          'BASE_SALARY', 'ALLOWANCE', 'BONUS', 'SOCIAL_CONTRIBUTION',
          'PENSION', 'SUPPLEMENTARY_PENSION', 'VOLUNTARY_SAVING',
          'ESPP', 'LTI', 'NON_CASH_BENEFIT', 'BENEFIT_DEDUCTION',
        ]
        for (const line of result.lines) {
          expect(line.code).toMatch(/^\/?\d{3,4}$/)
          expect(line.description.length).toBeGreaterThan(0)
          expect(typeof line.amount).toBe('number')
          expect(line.amount).toBeGreaterThan(0)
          expect(typeof line.isDeduction).toBe('boolean')
          expect(validCategories).toContain(line.category)
        }
      })

      it('has base salary line (code 1001)', () => {
        const baseSalary = result.lines.find((l) => l.code === '1001')
        expect(baseSalary).toBeDefined()
        expect(baseSalary!.category).toBe('BASE_SALARY')
        expect(baseSalary!.isDeduction).toBe(false)
      })

      it('summary has positive gross and net', () => {
        expect(result.summary.gross).toBeGreaterThan(0)
        expect(result.summary.net).toBeGreaterThan(0)
        expect(result.summary.paymentAmount).toBeGreaterThan(0)
        expect(result.summary.net).toBeLessThanOrEqual(result.summary.gross)
      })

      it('summary has valid currency and IBAN', () => {
        expect(result.summary.currency).toBe('CHF')
        expect(result.summary.targetIban).toMatch(/^CH/)
      })

      it('does not include subtotal lines (/101, /550, /110)', () => {
        const codes = result.lines.map((l) => l.code)
        expect(codes).not.toContain('/101')
        expect(codes).not.toContain('/550')
        expect(codes).not.toContain('/110')
      })

      it('toWipPayslip produces valid WIP data', () => {
        const wip = toWipPayslip(result, 'DOC-EMPLOYER')
        expect(wip.employer).toBe('DOC-EMPLOYER')
        expect(wip.period).toMatch(/^\d{4}-\d{2}$/)
        expect(wip.pay_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(wip.gross).toBeGreaterThan(0)
        expect(wip.net).toBeGreaterThan(0)
        expect(wip).not.toHaveProperty('imported_at')
      })

      it('toWipPayslipLine produces valid WIP data for every line', () => {
        for (const line of result.lines) {
          const wip = toWipPayslipLine(line, 'DOC-PAYSLIP')
          expect(wip.payslip).toBe('DOC-PAYSLIP')
          expect(wip.code).toBe(line.code)
          expect(typeof wip.amount).toBe('number')
          expect(wip).not.toHaveProperty('imported_at')
        }
      })
    })
  }
})
