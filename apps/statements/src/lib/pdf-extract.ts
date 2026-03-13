/**
 * Extracts text from a PDF file using pdf.js (pdfjs-dist).
 * Uses Y-coordinate grouping to preserve line structure.
 */
import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface TextItem {
  str: string
  transform: number[]
}

/**
 * Extract text from a PDF with proper line breaks based on Y-coordinates.
 * Items on the same Y line are joined with spaces; different Y values produce newlines.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    // Group text items by Y coordinate (rounded to handle minor float differences)
    const lineMap = new Map<number, Array<{ x: number; str: string }>>()

    for (const item of textContent.items) {
      if (!('str' in item) || !(item as TextItem).str.trim()) continue
      const tItem = item as TextItem
      const y = Math.round(tItem.transform[5]! * 10) / 10 // round to 1 decimal
      const x = tItem.transform[4]!

      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push({ x, str: tItem.str })
    }

    // Sort lines top-to-bottom (higher Y = higher on page in PDF coords)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)

    const pageLines: string[] = []
    for (const y of sortedYs) {
      const items = lineMap.get(y)!
      // Sort items left-to-right
      items.sort((a, b) => a.x - b.x)

      // Join items, using multi-space gaps for large X jumps (column separators)
      let line = ''
      let lastX = -1
      let lastWidth = 0
      for (const item of items) {
        if (lastX >= 0) {
          const gap = item.x - (lastX + lastWidth)
          if (gap > 20) {
            line += '   ' // column gap
          } else if (gap > 3) {
            line += ' '
          }
        }
        line += item.str
        lastX = item.x
        // Rough estimate of item width (5px per char average)
        lastWidth = item.str.length * 5
      }

      if (line.trim()) {
        pageLines.push(line.trim())
      }
    }

    pages.push(pageLines.join('\n'))
  }

  return pages.join('\n--- PAGE BREAK ---\n')
}

/**
 * Detect the type of financial document from PDF text.
 */
export type PdfDocumentType = 'yuh-statement' | 'roche-payslip' | 'unknown'

export function detectPdfType(text: string): PdfDocumentType {
  const lower = text.toLowerCase()
  if (lower.includes('kontoauszug') && (lower.includes('yuh') || lower.includes('swissquote') || lower.includes('swqb'))) {
    return 'yuh-statement'
  }
  if (lower.includes('payslip') || lower.includes('lohnabrechnung') || lower.includes('lohnausweis')) {
    return 'roche-payslip'
  }
  if (lower.includes('roche') && (lower.includes('gross') || lower.includes('brutto'))) {
    return 'roche-payslip'
  }
  return 'unknown'
}
