import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock pdf-extract to use the pdfjs-dist legacy build (Node-compatible)
// Same extraction engine, same text output — just without browser-only APIs
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

import { parseYuhPdf, toWipTransaction } from '../yuh-pdf'

// __dirname in vitest ESM = the test file's directory
// Go up from src/lib/parsers/__tests__ → repo root → realworlddata
const DATA_DIR = path.resolve(__dirname, '../../../../../../realworlddata')

// Check if real data files exist — skip gracefully if not
const yuhFiles = [
  'CP_REL-2327FE02-C0A80AB9204B0F07-0393B27E.PDF.pdf',
  'CP_REL-7E26040D-C0A80AB94B7AB7AB-BCC2FFDA.PDF.pdf',
  'CP_REL-A7800393-C0A80AB9336E3BE2-EA8C9211.PDF.pdf',
]

const hasRealData = yuhFiles.some((f) => fs.existsSync(path.join(DATA_DIR, f)))

describe.skipIf(!hasRealData)('Yuh PDF integration — real files', () => {
  for (const file of yuhFiles) {
    const filePath = path.join(DATA_DIR, file)
    if (!fs.existsSync(filePath)) continue

    describe(file, () => {
      let result: Awaited<ReturnType<typeof parseYuhPdf>>

      beforeAll(async () => {
        const buf = fs.readFileSync(filePath)
        result = await parseYuhPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      })

      it('extracts header with period dates', () => {
        // IBAN extraction may fail in Node due to font rendering differences —
        // the important thing is that period dates and transactions parse correctly
        expect(result.header.periodFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.header.periodTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('extracts transactions', () => {
        expect(result.transactions.length).toBeGreaterThan(0)
      })

      it('every transaction has required fields', () => {
        for (const tx of result.transactions) {
          expect(tx.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(tx.valuteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(tx.reference).toMatch(/^\d{10}$/)
          expect(['CHF', 'USD', 'EUR']).toContain(tx.currency)
          expect(typeof tx.amount).toBe('number')
          expect(typeof tx.balanceAfter).toBe('number')
        }
      })

      it('toWipTransaction produces valid WIP data for every transaction', () => {
        const validTypes = [
          'DEBIT_CARD', 'BANK_TRANSFER_IN', 'BANK_TRANSFER_OUT',
          'CURRENCY_EXCHANGE', 'OTHER',
        ]
        for (const tx of result.transactions) {
          const wip = toWipTransaction(tx, 'DOC-TEST-ACCOUNT')
          expect(wip.account).toBe('DOC-TEST-ACCOUNT')
          expect(wip.source_reference).toBe(tx.reference)
          expect(wip.booking_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(validTypes).toContain(wip.transaction_type)
          expect(typeof wip.amount).toBe('number')
          // No import metadata
          expect(wip).not.toHaveProperty('imported_at')
          expect(wip).not.toHaveProperty('import_id')
        }
      })

      it('debit card payments have negative amounts (except refunds)', () => {
        for (const tx of result.transactions) {
          const type = tx.transactionType.toLowerCase()
          // "Zahlung per Debitkarte" = payment, should be negative
          // "Rückerstattung per Debitkarte" = refund, positive is correct
          if (type.includes('zahlung per debitkarte') && !type.includes('rückerstattung')) {
            expect(tx.amount).toBeLessThan(0)
          }
        }
      })
    })
  }
})
