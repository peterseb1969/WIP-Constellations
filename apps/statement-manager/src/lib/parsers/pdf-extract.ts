import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

// Use the bundled worker for Vite
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface TextItem {
  str: string
  transform: number[]
}

/**
 * Extract text from a PDF buffer with line reconstruction.
 * Groups text items by Y-position to reconstruct lines.
 * Browser-safe — no fs dependency.
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<{ text: string; numPages: number }> {
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
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
