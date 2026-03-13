/**
 * Test script: runs the full extraction + parsing pipeline and shows results.
 * Run: node --loader ts-node/esm test-parsers.mjs
 *
 * Since we can't easily import TS directly, we replicate the extraction
 * and then import parser logic inline.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const DATA_DIR = resolve(import.meta.dirname, '../../realworlddata')

// ── Replicate pdf-extract.ts logic ──
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
          if (gap > 20) line += '   '
          else if (gap > 3) line += ' '
        }
        line += item.str
        lastX = item.x
        lastWidth = item.str.length * 5
      }
      if (line.trim()) pageLines.push(line.trim())
    }
    pages.push(pageLines.join('\n'))
  }
  return pages.join('\n--- PAGE BREAK ---\n')
}

// ── Replicate detectPdfType ──
function detectPdfType(text) {
  const lower = text.toLowerCase()
  if (lower.includes('kontoauszug') && (lower.includes('yuh') || lower.includes('swissquote') || lower.includes('swqb'))) return 'yuh-statement'
  if (lower.includes('payslip') || lower.includes('lohnabrechnung') || lower.includes('lohnausweis')) return 'roche-payslip'
  if (lower.includes('roche') && (lower.includes('gross') || lower.includes('brutto'))) return 'roche-payslip'
  return 'unknown'
}

// ── Inline Yuh parser (replicate yuh-parser.ts logic) ──
const YUH_TYPE_MAP = {
  'zahlung per debitkarte': 'DEBIT_CARD',
  'automatisierter währungstausch': 'CURRENCY_EXCHANGE',
  'automatisierter wahrungstausch': 'CURRENCY_EXCHANGE',
  'währungsumtausch': 'CURRENCY_EXCHANGE',
  'wahrungsumtausch': 'CURRENCY_EXCHANGE',
  'zahlung von': 'BANK_TRANSFER_IN',
  'zahlung an': 'BANK_TRANSFER_OUT',
  'anfangsbestand': '_SKIP',
  'schlussbilanz': '_SKIP',
}

function detectTxType(info) {
  const lower = info.toLowerCase()
  for (const [kw, type] of Object.entries(YUH_TYPE_MAP)) {
    if (lower.includes(kw)) return type
  }
  return 'OTHER'
}

function parseSwissDate(v) {
  const p = v.split('.')
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : v
}

function parseSwissNumber(v) {
  if (!v || !v.trim()) return 0
  return Number(v.replace(/'/g, '').replace(/,/g, '.'))
}

function extractReferenceAndClean(rest) {
  // Try spaced reference first
  const spacedRef = rest.match(/\b(\d{9,10})\b/)
  if (spacedRef) {
    const refIdx = rest.indexOf(spacedRef[0])
    const after = rest.substring(refIdx + spacedRef[0].length)
    const before = rest.substring(0, refIdx)
    return { reference: spacedRef[1], textBefore: before.trim(), textAfter: after.trim() }
  }
  // Try glued reference: look for 9-10 digits followed immediately by amount-like pattern
  const gluedRef = rest.match(/(\d{9,10})([\d']+\.\d{2})/)
  if (gluedRef) {
    const refIdx = rest.indexOf(gluedRef[0])
    const before = rest.substring(0, refIdx)
    const after = gluedRef[2] + rest.substring(refIdx + gluedRef[0].length)
    return { reference: gluedRef[1], textBefore: before.trim(), textAfter: after.trim() }
  }
  return { reference: '', textBefore: rest, textAfter: '' }
}

function isCurrencyExchangeCredit(detailLines, currentCurrency) {
  for (const dl of detailLines) {
    const m = dl.match(/^([A-Z]{3})\s*-\s*([A-Z]{3})$/)
    if (m) {
      const dest = m[2]
      return dest === currentCurrency
    }
  }
  return false
}

function parseYuhPdfText(fullText) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  let iban = ''
  for (const line of lines) {
    const m = line.match(/CH[\d\s]{10,30}\d/)
    if (m) { iban = m[0].replace(/\s/g, ''); break }
  }

  let currentCurrency = 'CHF'
  const transactions = []
  const txLineRegex = /^(\d{2}\.\d{2}\.\d{4})(.+)/
  const skipPatterns = ['DATUM', 'Saldo per', 'Total ', 'Herrn', 'IBAN', 'Seite', 'Dokument', 'Vom ', 'Die vorliegende', 'Bescheid', 'Swissquote', 'PAGE BREAK', '©2022', 'Die Bank', 'Endsaldo', 'Anfangssaldo', 'Kunde', 'SWIFT', 'Yuh account', 'Dein Kontoauszug', 'Bluttrainweg', 'Kontoauszug vom']

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const currencyMatch = line.match(/Kontoauszug in (\w+)/)
    if (currencyMatch) { currentCurrency = currencyMatch[1]; i++; continue }
    if (skipPatterns.some(p => line.startsWith(p) || line.includes(p))) { i++; continue }

    const txMatch = line.match(txLineRegex)
    if (txMatch) {
      const bookingDate = txMatch[1]
      const rest = txMatch[2]
      const txType = detectTxType(rest)
      if (txType === '_SKIP') { i++; continue }

      const { reference, textBefore, textAfter } = extractReferenceAndClean(rest)

      // Gather detail lines
      const detailLines = []
      let j = i + 1
      while (j < lines.length) {
        const nl = lines[j]
        if (nl.match(/^\d{2}\.\d{2}\.\d{4}/) || skipPatterns.some(p => nl.startsWith(p) || nl.includes(p)) || nl.match(/Kontoauszug in/)) break
        detailLines.push(nl)
        j++
      }

      // Extract numbers from textAfter
      const numPattern = /[\d']+\.\d{2}/g
      const numbers = []
      let nm
      while ((nm = numPattern.exec(textAfter)) !== null) numbers.push(nm[0])
      // Also extract from rest if textAfter is empty
      if (numbers.length === 0) {
        const restNums = /[\d']+\.\d{2}/g
        while ((nm = restNums.exec(rest)) !== null) numbers.push(nm[0])
      }

      // Extract valuta date from rest
      const allDates = [...rest.matchAll(/(\d{2}\.\d{2}\.\d{4})/g)]
      const valueDate = allDates.length > 0 ? allDates[allDates.length - 1][1] : bookingDate

      // Determine amount sign
      let amount = numbers.length >= 1 ? parseSwissNumber(numbers[0]) : 0
      let balance = numbers.length >= 2 ? parseSwissNumber(numbers[numbers.length - 1]) : null

      // If balance equals amount, we only have one number
      if (numbers.length === 1) balance = null

      const isCredit = txType === 'BANK_TRANSFER_IN' ||
        (txType === 'CURRENCY_EXCHANGE' && isCurrencyExchangeCredit(detailLines, currentCurrency))

      if (!isCredit && amount > 0) amount = -amount
      if (isCredit && amount < 0) amount = -amount

      // Counterparty from detail
      let counterparty = ''
      for (const dl of detailLines) {
        if (dl.startsWith('xxxx') || dl.match(/^\d+ CHF/) || dl.match(/^[A-Z]{3}\s*-\s*[A-Z]{3}$/) ||
            dl.match(/^1 [A-Z]{3} =/) || dl.match(/^CH\d/) || dl.match(/^DE\d/)) continue
        if (dl.length > 3 && !dl.match(/^\d{4}\s/)) { counterparty = dl; break }
      }

      const description = [textBefore, ...detailLines].filter(Boolean).join(' | ').substring(0, 200)

      if (reference) {
        transactions.push({
          sourceReference: reference,
          bookingDate: parseSwissDate(bookingDate),
          valueDate: parseSwissDate(valueDate),
          currency: currentCurrency,
          amount,
          balance,
          transactionType: txType,
          description,
          counterpartyName: counterparty,
        })
      }
      i = j
      continue
    }
    i++
  }

  return { iban, transactions }
}

// ── Inline Payslip parser (replicate payslip-parser.ts logic) ──
const MONTH_MAP = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12',
}

const CODE_TO_CATEGORY = {
  '1001': 'BASE_SALARY',
  '2003': 'ALLOWANCE', '2004': 'ALLOWANCE', '2005': 'ALLOWANCE', '2123': 'ALLOWANCE',
  '4101': 'NON_CASH_BENEFIT', '4103': 'BONUS',
  '4301': 'ESPP',
  '4311': 'NON_CASH_BENEFIT', '4313': 'LTI', '4318': 'NON_CASH_BENEFIT',
  '6103': 'PENSION', '6104': 'PENSION',
  '6106': 'SUPPLEMENTARY_PENSION', '6109': 'SUPPLEMENTARY_PENSION',
  '6108': 'VOLUNTARY_SAVING',
  '6201': 'BENEFIT_DEDUCTION',
}

function categorize(code) {
  if (CODE_TO_CATEGORY[code]) return CODE_TO_CATEGORY[code]
  const p = code[0]
  if (p === '1') return 'BASE_SALARY'
  if (p === '2') return 'ALLOWANCE'
  if (p === '3') return 'BONUS'
  if (p === '4') return 'NON_CASH_BENEFIT'
  if (p === '5') return 'BENEFIT_DEDUCTION'
  if (p === '6') return 'PENSION'
  return 'OTHER'
}

function parsePsNumber(v) {
  if (!v) return 0
  const c = v.replace(/,/g, '').replace(/\s/g, '')
  return c.endsWith('-') ? -Math.abs(Number(c.slice(0, -1))) : Number(c)
}

function parsePayslipPdfText(fullText) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  let empNo = '', period = '', payDate = '', currency = 'CHF'
  let gross = 0, net = 0, paymentAmount = 0, capUtil = null, targetIban = ''
  const psLines = []
  let totalSocial = 0, totalPension = 0, totalDeductions = 0

  for (const line of lines) {
    // Stop at German page
    if (line.startsWith('Herr') && line.includes('Firma')) break
    if (line.startsWith('Herr') && !line.includes('Company')) {
      if (line.includes('Firma') || lines.indexOf(line) > 10) break
    }
    if (line.includes('Verdienste') || line.includes('Beschreibung')) break
    if (line.includes('PAGE BREAK')) break

    // Employee Nr
    const empM = line.match(/Employee\s+Nr\.?\s*(\d{7,8})/i)
    if (empM) empNo = empM[1]

    // Capacity
    const capM = line.match(/Capacity\s+util\s*(\d+)%/i)
    if (capM) capUtil = Number(capM[1])

    // Pay period
    const perM = line.match(/Pay\s+period\s+(\w+)\s+(\d{4})/i)
    if (perM) {
      const mo = MONTH_MAP[perM[1].toLowerCase()]
      if (mo) period = `${perM[2]}-${mo}`
    }

    // Pay date
    const pdM = line.match(/Pay\s+date\s+(\d{2})\.(\d{2})\.(\d{4})/i)
    if (pdM) payDate = `${pdM[3]}-${pdM[2]}-${pdM[1]}`

    // IBAN
    const ibanM = line.match(/(CH\w{19,21})/i)
    if (ibanM) targetIban = ibanM[1]

    // GROSS
    const grossM = line.match(/\/101\s+(?:GROSS|BRUTTO)\s+([\d,]+\.\d{2})/)
    if (grossM) gross = Math.abs(parsePsNumber(grossM[1]))

    // NET
    const netM = line.match(/\/550\s+(?:NET|NETTO)\s+([\d,]+\.\d{2})/)
    if (netM) net = Math.abs(parsePsNumber(netM[1]))

    // DEDUCTIONS
    const dedM = line.match(/\/110\s+.+?([\d,]+\.\d{2}-?)/)
    if (dedM) totalDeductions = Math.abs(parsePsNumber(dedM[1]))

    // Payment Amount
    const payM = line.match(/Payment\s+Amount\s+([\d,]+\.\d{2})/)
    if (payM) paymentAmount = parsePsNumber(payM[1])

    // Bank transfer with CHF
    if (!paymentAmount) {
      const bankM = line.match(/([\d,]+\.\d{2})\s+CHF\s*$/)
      if (bankM && line.includes('UBS')) paymentAmount = parsePsNumber(bankM[1])
    }

    // Social contribution lines: /4xx
    const socialM = line.match(/^\/(4\d{2})\s+(.+?)\s{2,}([\d,]+\.\d{2})\s+([\d.]+)\s*%\s+([\d,]+\.\d{2}-?)/)
    if (socialM) {
      const code = `/${socialM[1]}`
      const desc = socialM[2].trim()
      const basis = parsePsNumber(socialM[3])
      const rate = Number(socialM[4])
      const amt = parsePsNumber(socialM[5])
      totalSocial += Math.abs(amt)
      psLines.push({ code, description: desc, category: 'SOCIAL_CONTRIBUTION', amount: Math.abs(amt), basis, rate, isDeduction: true })
      continue
    }

    // Check for dual-column lines: CODE TEXT AMOUNT CODE TEXT AMOUNT
    // Detect: 4-digit code, then later another 4-digit code
    const dualM = line.match(/^(\d{4})\s+(.+?)\s{2,}([\d,]+\.\d{2}-?)\s+(\d{4})\s+(.+?)\s{2,}([\d,]+\.\d{2}-?)$/)
    if (dualM) {
      // Left item
      const lCode = dualM[1], lDesc = dualM[2].trim(), lAmt = parsePsNumber(dualM[3])
      const lIsDed = dualM[3].endsWith('-') || lAmt < 0
      psLines.push({ code: lCode, description: lDesc, category: categorize(lCode), amount: Math.abs(lAmt), basis: null, rate: null, isDeduction: lIsDed })
      // Right item (non-cash benefit)
      const rCode = dualM[4], rDesc = dualM[5].trim(), rAmt = parsePsNumber(dualM[6])
      const rIsDed = dualM[6].endsWith('-') || rAmt < 0
      const rCat = CODE_TO_CATEGORY[rCode] || 'NON_CASH_BENEFIT'
      psLines.push({ code: rCode, description: rDesc, category: rCat, amount: Math.abs(rAmt), basis: null, rate: null, isDeduction: rIsDed })
      continue
    }

    // Single line items: CODE TEXT [BASIS] AMOUNT
    const lineM = line.match(/^(\d{4})\s+(.+)/)
    if (lineM) {
      const code = lineM[1]
      const restLine = lineM[2]
      const nums = restLine.match(/[\d,]+\.\d{2}-?/g) || []
      if (nums.length === 0) continue
      const rawAmt = nums[nums.length - 1]
      const amt = parsePsNumber(rawAmt)
      const isDed = rawAmt.endsWith('-') || amt < 0

      const firstNumIdx = restLine.indexOf(nums[0])
      let desc = restLine.substring(0, firstNumIdx).trim().replace(/\s{2,}/g, ' ')

      let basis = null, rate = null
      if (nums.length >= 2) basis = parsePsNumber(nums[0])
      const rateM = restLine.match(/([\d.]+)\s*%/)
      if (rateM) rate = Number(rateM[1])

      const cat = categorize(code)
      if (cat === 'PENSION' || cat === 'SUPPLEMENTARY_PENSION' || cat === 'VOLUNTARY_SAVING') {
        totalPension += Math.abs(amt)
      }

      psLines.push({ code, description: desc, category: cat, amount: Math.abs(amt), basis, rate, isDeduction: isDed })
    }
  }

  if (!paymentAmount && net > 0 && totalDeductions > 0) paymentAmount = net - totalDeductions
  if (!payDate && period) payDate = `${period}-25`

  return {
    employeeNumber: empNo, period, payDate, currency, gross, net, paymentAmount,
    totalSocialContributions: totalSocial, totalPensionContributions: totalPension,
    totalDeductions, capacityUtilization: capUtil, targetIban, lines: psLines,
  }
}

// ── Run tests ──
const files = readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))

for (const filename of files) {
  const filepath = resolve(DATA_DIR, filename)
  const text = await extractSmartText(filepath)
  const type = detectPdfType(text)

  console.log('='.repeat(100))
  console.log(`FILE: ${filename}`)
  console.log(`TYPE: ${type}`)
  console.log('='.repeat(100))

  if (type === 'yuh-statement') {
    const result = parseYuhPdfText(text)
    console.log(`IBAN: ${result.iban}`)
    console.log(`Transactions: ${result.transactions.length}`)
    console.log()
    for (const tx of result.transactions) {
      console.log(`  ${tx.bookingDate}  ${tx.currency}  ${tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}  ${tx.transactionType.padEnd(20)} ref=${tx.sourceReference}  bal=${tx.balance?.toFixed(2) ?? '?'}  ${tx.counterpartyName || tx.description.substring(0, 60)}`)
    }
  } else if (type === 'roche-payslip') {
    const result = parsePayslipPdfText(text)
    console.log(`Employee: ${result.employeeNumber}`)
    console.log(`Period: ${result.period}`)
    console.log(`Pay date: ${result.payDate}`)
    console.log(`Gross: ${result.gross}`)
    console.log(`Net: ${result.net}`)
    console.log(`Payment: ${result.paymentAmount}`)
    console.log(`Social contributions: ${result.totalSocialContributions}`)
    console.log(`Pension contributions: ${result.totalPensionContributions}`)
    console.log(`Total deductions: ${result.totalDeductions}`)
    console.log(`Capacity: ${result.capacityUtilization}%`)
    console.log(`IBAN: ${result.targetIban}`)
    console.log(`Line items: ${result.lines.length}`)
    console.log()
    for (const l of result.lines) {
      console.log(`  ${l.code.padEnd(6)} ${l.isDeduction ? '-' : '+'}${l.amount.toFixed(2).padStart(10)}  ${l.category.padEnd(24)} ${l.description}`)
    }
  } else {
    console.log('Unknown document type')
  }
  console.log()
}

console.log('DONE')
