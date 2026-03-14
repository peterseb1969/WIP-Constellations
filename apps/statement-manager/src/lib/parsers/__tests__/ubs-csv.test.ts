import { describe, it, expect } from 'vitest'
import {
  extractCounterparty,
  extractIban,
  extractReference,
  extractCardNumber,
  resolveAmount,
  guessTransactionType,
  parseUbsCsv,
  toWipTransaction,
} from '../ubs-csv'
import type { UbsTransaction } from '../ubs-csv'

// ---------------------------------------------------------------------------
// Helper to build a minimal UbsTransaction
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<UbsTransaction> = {}): UbsTransaction {
  return {
    closingDate: '2026-01-15',
    closingTime: '12:00',
    bookingDate: '2026-01-15',
    valueDate: '2026-01-15',
    currency: 'CHF',
    debit: null,
    credit: null,
    singleAmount: null,
    balance: 1000,
    transactionId: 'TX123456',
    description1: '',
    description2: '',
    description3: '',
    footnotes: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// extractCounterparty
// ---------------------------------------------------------------------------

describe('extractCounterparty', () => {
  it('parses name and address from semicolon-separated string', () => {
    const result = extractCounterparty('John Doe;Main Street 1;8000 Zurich;CH')
    expect(result.name).toBe('John Doe')
    expect(result.address).toBe('Main Street 1, 8000 Zurich, CH')
  })

  it('handles name only', () => {
    const result = extractCounterparty('Jane Smith')
    expect(result.name).toBe('Jane Smith')
    expect(result.address).toBe('')
  })

  it('handles empty string', () => {
    const result = extractCounterparty('')
    expect(result.name).toBe('')
    expect(result.address).toBe('')
  })

  it('trims whitespace', () => {
    const result = extractCounterparty('  John Doe ; Main St 1 ; Zurich ')
    expect(result.name).toBe('John Doe')
    expect(result.address).toBe('Main St 1, Zurich')
  })
})

// ---------------------------------------------------------------------------
// extractIban
// ---------------------------------------------------------------------------

describe('extractIban', () => {
  it('extracts IBAN from Konto-Nr pattern', () => {
    const result = extractIban('Konto-Nr. IBAN: CH93 0076 2011 6238 5295 7;')
    expect(result).toBe('CH9300762011623852957')
  })

  it('returns null when no IBAN present', () => {
    expect(extractIban('some other text')).toBeNull()
    expect(extractIban('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractReference
// ---------------------------------------------------------------------------

describe('extractReference', () => {
  it('extracts QRR reference number', () => {
    const result = extractReference('Referenz-Nr. QRR: 21 00000 00003 13947 09400 00901;')
    expect(result).toBe('21 00000 00003 13947 09400 00901')
  })

  it('returns null when no reference', () => {
    expect(extractReference('no reference here')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractCardNumber
// ---------------------------------------------------------------------------

describe('extractCardNumber', () => {
  it('extracts card number from description2', () => {
    const result = extractCardNumber('18810344-0 04/28; Zahlung Debitkarte')
    expect(result).toBe('18810344-0 04/28')
  })

  it('returns null when no card number', () => {
    expect(extractCardNumber('e-banking-Vergütungsauftrag')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveAmount
// ---------------------------------------------------------------------------

describe('resolveAmount', () => {
  it('prefers debit over credit', () => {
    expect(resolveAmount(makeTx({ debit: -50, credit: 100 }))).toBe(-50)
  })

  it('falls back to credit', () => {
    expect(resolveAmount(makeTx({ credit: 100 }))).toBe(100)
  })

  it('falls back to singleAmount', () => {
    expect(resolveAmount(makeTx({ singleAmount: 75 }))).toBe(75)
  })

  it('returns null when all are null', () => {
    expect(resolveAmount(makeTx())).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// guessTransactionType
// ---------------------------------------------------------------------------

describe('guessTransactionType', () => {
  it('detects debit card', () => {
    expect(guessTransactionType(makeTx({ description2: 'Zahlung Debitkarte' }))).toBe('DEBIT_CARD')
  })

  it('detects e-bill', () => {
    expect(guessTransactionType(makeTx({ description2: 'EBILL-RECHNUNG' }))).toBe('E_BILL')
  })

  it('detects standing order', () => {
    expect(guessTransactionType(makeTx({ description2: 'Dauerauftrag' }))).toBe('STANDING_ORDER')
  })

  it('detects fee from description1', () => {
    expect(guessTransactionType(makeTx({ description1: 'Saldo Dienstleistungspreis' }))).toBe('FEE')
  })

  it('returns OTHER for unknown', () => {
    expect(guessTransactionType(makeTx({ description2: 'something else' }))).toBe('OTHER')
  })
})

// ---------------------------------------------------------------------------
// toWipTransaction
// ---------------------------------------------------------------------------

describe('toWipTransaction', () => {
  it('maps a debit transaction correctly', () => {
    const tx = makeTx({
      debit: -150.50,
      transactionId: 'ABC123',
      bookingDate: '2026-01-10',
      valueDate: '2026-01-11',
      description1: 'Migros;Clarastrasse 10;Basel',
      description2: '18810344-0 04/28; Zahlung Debitkarte',
      description3: '',
    })
    const result = toWipTransaction(tx, 'DOC-ACCOUNT-1')
    expect(result).not.toBeNull()
    expect(result!.account).toBe('DOC-ACCOUNT-1')
    expect(result!.source_reference).toBe('ABC123')
    expect(result!.amount).toBe(-150.50)
    expect(result!.transaction_type).toBe('DEBIT_CARD')
    expect(result!.counterparty_name).toBe('Migros')
    expect(result!.card_number).toBe('18810344-0 04/28')
  })

  it('skips transactions with no amount', () => {
    const tx = makeTx({ transactionId: 'ABC' })
    expect(toWipTransaction(tx, 'DOC-1')).toBeNull()
  })

  it('skips transactions with no transactionId', () => {
    const tx = makeTx({ debit: -10, transactionId: '' })
    expect(toWipTransaction(tx, 'DOC-1')).toBeNull()
  })

  it('does not include import metadata', () => {
    const tx = makeTx({ debit: -10, transactionId: 'X1' })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result).not.toBeNull()
    // Must not contain any import-specific fields
    expect(result).not.toHaveProperty('imported_at')
    expect(result).not.toHaveProperty('import_date')
    expect(result).not.toHaveProperty('import_id')
    expect(result).not.toHaveProperty('file_id')
  })
})

// ---------------------------------------------------------------------------
// parseUbsCsv — integration with real CSV format
// ---------------------------------------------------------------------------

describe('parseUbsCsv', () => {
  const sampleCsv = [
    'Kontonummer:;CH12345;',
    'IBAN:;CH93 0076 2011 6238 5295 7;',
    'Von:;2026-01-01;',
    'Bis:;2026-01-31;',
    'Anfangssaldo:;5000.00;',
    'Schlusssaldo:;4500.00;',
    'Bewertet in:;CHF;',
    'Anzahl Transaktionen;3;',
    'Abschlussdatum;Abschlusszeit;Buchungsdatum;Valutadatum;Währung;Belastung;Gutschrift;Einzelbetrag;Saldo;Transaktions-Nr;Beschreibung1;Beschreibung2;Beschreibung3;Fussnoten',
    '2026-01-05;12:00;2026-01-05;2026-01-05;CHF;-50.00;;;4950.00;TX001;Migros;Zahlung Debitkarte;;',
    '2026-01-10;14:00;2026-01-10;2026-01-11;CHF;;200.00;;5150.00;TX002;Employer AG;e-banking-Gutschrift;;',
    '2026-01-15;09:00;2026-01-15;2026-01-15;CHF;-100.00;;;5050.00;TX003;Swisscom;EBILL-RECHNUNG;;',
  ].join('\n')

  it('parses header correctly', () => {
    const result = parseUbsCsv(sampleCsv)
    expect(result.header.iban).toBe('CH9300762011623852957')
    expect(result.header.currency).toBe('CHF')
    expect(result.header.openingBalance).toBe(5000)
    expect(result.header.closingBalance).toBe(4500)
  })

  it('parses all transactions', () => {
    const result = parseUbsCsv(sampleCsv)
    expect(result.transactions).toHaveLength(3)
  })

  it('parses debit transaction', () => {
    const result = parseUbsCsv(sampleCsv)
    const tx = result.transactions[0]
    expect(tx.transactionId).toBe('TX001')
    expect(tx.debit).toBe(-50)
    expect(tx.description1).toBe('Migros')
  })

  it('parses credit transaction', () => {
    const result = parseUbsCsv(sampleCsv)
    const tx = result.transactions[1]
    expect(tx.credit).toBe(200)
    expect(tx.description2).toBe('e-banking-Gutschrift')
  })

  it('throws on invalid CSV without header row', () => {
    expect(() => parseUbsCsv('just,some,random,data')).toThrow('Could not find column headers')
  })
})
