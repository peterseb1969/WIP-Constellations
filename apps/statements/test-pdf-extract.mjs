/**
 * Test script to show exactly what our PDF extraction + parsers produce.
 * Run: node test-pdf-extract.mjs
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const DATA_DIR = resolve(import.meta.dirname, '../../realworlddata')

// Find all PDFs in realworlddata
const files = readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))

/**
 * Extract text using the same Y-coordinate grouping as pdf-extract.ts
 */
async function extractSmartText(filepath) {
  const data = new Uint8Array(readFileSync(filepath))
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    const lineMap = new Map()

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] * 10) / 10
      const x = item.transform[4]

      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y).push({ x, str: item.str })
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)

    const pageLines = []
    for (const y of sortedYs) {
      const items = lineMap.get(y)
      items.sort((a, b) => a.x - b.x)

      let line = ''
      let lastX = -1
      let lastWidth = 0
      for (const item of items) {
        if (lastX >= 0) {
          const gap = item.x - (lastX + lastWidth)
          if (gap > 20) {
            line += '   '
          } else if (gap > 3) {
            line += ' '
          }
        }
        line += item.str
        lastX = item.x
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

for (const filename of files) {
  const filepath = resolve(DATA_DIR, filename)
  const text = await extractSmartText(filepath)

  console.log('='.repeat(100))
  console.log(`FILE: ${filename}`)
  console.log('='.repeat(100))
  console.log(text)
  console.log('\n')
}

console.log('DONE — copy the output above and compare with parser expectations')
