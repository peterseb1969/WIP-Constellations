import Tesseract from 'tesseract.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedReceiptLine {
  description: string
  quantity: number | null
  unitPrice: number | null
  total: number
}

export interface ExtractedReceipt {
  merchant: string
  date: string          // YYYY-MM-DD or empty
  currency: string
  total: number | null
  paymentMethod: string
  lines: ExtractedReceiptLine[]
  rawText: string
  confidence: number    // 0-100, overall OCR confidence
}

// ---------------------------------------------------------------------------
// Known merchants — matched case-insensitively against OCR text
// ---------------------------------------------------------------------------

const KNOWN_MERCHANTS = [
  'Migros', 'Coop', 'Lidl', 'Aldi', 'Denner', 'Spar', 'Volg',
  'Manor', 'Globus', 'Müller', 'Interdiscount', 'MediaMarkt',
  'Digitec', 'Galaxus', 'Ikea', 'Decathlon', 'Ochsner Sport',
  'PKZ', 'H&M', 'Zara', 'Dosenbach', 'Apotheke', 'Amavita',
]

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export async function ocrImage(
  imageData: ArrayBuffer | Blob | string,
  onProgress?: (progress: number) => void,
): Promise<{ text: string; confidence: number }> {
  const result = await Tesseract.recognize(imageData, 'deu+eng', {
    logger: (info: { status: string; progress: number }) => {
      if (info.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(info.progress * 100))
      }
    },
  })
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  }
}

// ---------------------------------------------------------------------------
// Regex extraction — best effort, user corrects the rest
// ---------------------------------------------------------------------------

const DATE_RE = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/
const PRICE_RE = /(\d{1,4}[.,]\d{2})\s*$/
const TOTAL_RE = /(?:total|summe|gesamt|betrag|chf|eur)\s*[:\s]*(\d{1,6}[.,]\d{2})/i
const PAYMENT_RE = /\b(bar|karte|maestro|visa|mastercard|twint|postcard|ec|vpay)\b/i
const QUANTITY_PRICE_RE = /^(\d+)\s*[x×*]\s*(\d+[.,]\d{2})\s+(.+?)\s+(\d+[.,]\d{2})\s*$/i
const ITEM_LINE_RE = /^(.+?)\s{2,}(\d+[.,]\d{2})\s*$/

function parseSwissPrice(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

function extractMerchant(text: string): string {
  const upper = text.toUpperCase()
  for (const m of KNOWN_MERCHANTS) {
    if (upper.includes(m.toUpperCase())) return m
  }
  // Fallback: first non-empty line that looks like a name (no digits)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 5)) {
    if (!/\d/.test(line) && line.length > 2 && line.length < 40) {
      return line
    }
  }
  return ''
}

function extractDate(text: string): string {
  const m = DATE_RE.exec(text)
  if (!m) return ''
  const day = m[1].padStart(2, '0')
  const month = m[2].padStart(2, '0')
  let year = m[3]
  if (year.length === 2) year = `20${year}`
  return `${year}-${month}-${day}`
}

function extractTotal(text: string): number | null {
  const m = TOTAL_RE.exec(text)
  if (m) return parseSwissPrice(m[1])

  // Fallback: last price-like number on a line containing "total" or "chf"
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (/total|summe|chf/i.test(line)) {
      const pm = PRICE_RE.exec(line)
      if (pm) return parseSwissPrice(pm[1])
    }
  }
  return null
}

function extractPaymentMethod(text: string): string {
  const m = PAYMENT_RE.exec(text)
  return m ? m[1].toUpperCase() : ''
}

function extractLines(text: string): ExtractedReceiptLine[] {
  const lines: ExtractedReceiptLine[] = []
  const textLines = text.split('\n')

  for (const raw of textLines) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length < 3) continue

    // Skip header/footer lines
    if (/total|summe|gesamt|mwst|rabatt|sub.?total|bar|karte|twint|vielen dank/i.test(trimmed)) continue
    if (/datum|kasse|bon|filiale|tel|www\.|http/i.test(trimmed)) continue

    // Try "quantity x price  description  total" pattern
    const qm = QUANTITY_PRICE_RE.exec(trimmed)
    if (qm) {
      lines.push({
        description: qm[3].trim(),
        quantity: parseInt(qm[1], 10),
        unitPrice: parseSwissPrice(qm[2]),
        total: parseSwissPrice(qm[4]),
      })
      continue
    }

    // Try "description    price" pattern (2+ spaces between)
    const im = ITEM_LINE_RE.exec(trimmed)
    if (im) {
      const desc = im[1].trim()
      // Skip lines that are just numbers or very short
      if (desc.length < 2 || /^\d+$/.test(desc)) continue
      lines.push({
        description: desc,
        quantity: null,
        unitPrice: null,
        total: parseSwissPrice(im[2]),
      })
      continue
    }
  }

  return lines
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export function extractReceiptFields(rawText: string, confidence: number): ExtractedReceipt {
  return {
    merchant: extractMerchant(rawText),
    date: extractDate(rawText),
    currency: 'CHF',
    total: extractTotal(rawText),
    paymentMethod: extractPaymentMethod(rawText),
    lines: extractLines(rawText),
    rawText,
    confidence,
  }
}

// ---------------------------------------------------------------------------
// WIP mapping — FIN_TRANSACTION_LINE
// ---------------------------------------------------------------------------

export function toWipTransactionLine(
  line: ExtractedReceiptLine,
  transactionDocId: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    transaction: transactionDocId,
    description: line.description,
    total: line.total,
  }
  if (line.quantity != null) data.quantity = line.quantity
  if (line.unitPrice != null) data.unit_price = line.unitPrice
  return data
}
