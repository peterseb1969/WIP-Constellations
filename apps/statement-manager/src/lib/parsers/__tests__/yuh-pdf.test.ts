import { describe, it, expect, vi } from 'vitest'

// Mock pdf-extract to avoid pdfjs-dist (needs DOMMatrix, browser-only)
vi.mock('../pdf-extract', () => ({
  extractPdfText: vi.fn(),
}))

import { toWipTransaction } from '../yuh-pdf'
import type { YuhTransaction } from '../yuh-pdf'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<YuhTransaction> = {}): YuhTransaction {
  return {
    bookingDate: '2026-01-15',
    valuteDate: '2026-01-15',
    currency: 'CHF',
    reference: '1234567890',
    amount: -50.00,
    balanceAfter: 950.00,
    transactionType: 'Zahlung per Debitkarte',
    cardNumber: 'xxxx 8748',
    counterpartyName: 'Migros',
    counterpartyAddress: 'Basel',
    counterpartyIban: null,
    exchangeRate: null,
    exchangeTargetCurrency: null,
    rawBlock: 'raw block text',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// toWipTransaction
// ---------------------------------------------------------------------------

describe('toWipTransaction', () => {
  it('maps a debit card transaction', () => {
    const tx = makeTx()
    const result = toWipTransaction(tx, 'DOC-YUH-ACCT')

    expect(result.account).toBe('DOC-YUH-ACCT')
    expect(result.source_reference).toBe('1234567890')
    expect(result.booking_date).toBe('2026-01-15')
    expect(result.currency).toBe('CHF')
    expect(result.amount).toBe(-50)
    expect(result.transaction_type).toBe('DEBIT_CARD')
    expect(result.counterparty_name).toBe('Migros')
    expect(result.card_number).toBe('xxxx 8748')
  })

  it('maps an incoming transfer', () => {
    const tx = makeTx({
      transactionType: 'Zahlung von',
      amount: 3000,
      counterpartyName: 'Employer AG',
      counterpartyIban: 'CH9300762011623852957',
      cardNumber: null,
    })
    const result = toWipTransaction(tx, 'DOC-1')

    expect(result.transaction_type).toBe('BANK_TRANSFER_IN')
    expect(result.counterparty_iban).toBe('CH9300762011623852957')
    expect(result).not.toHaveProperty('card_number')
  })

  it('maps an outgoing transfer', () => {
    const tx = makeTx({
      transactionType: 'Zahlung an',
      amount: -200,
    })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result.transaction_type).toBe('BANK_TRANSFER_OUT')
  })

  it('maps a currency exchange', () => {
    const tx = makeTx({
      transactionType: 'Automatisierter Währungsumtausch',
      exchangeRate: 0.9234,
      exchangeTargetCurrency: 'EUR',
      counterpartyName: null,
      counterpartyAddress: null,
      cardNumber: null,
    })
    const result = toWipTransaction(tx, 'DOC-1')

    expect(result.transaction_type).toBe('CURRENCY_EXCHANGE')
    expect(result.exchange_rate).toBe(0.9234)
    expect(result.exchange_target_currency).toBe('EUR')
    expect(result).not.toHaveProperty('counterparty_name')
  })

  it('maps unknown type to OTHER', () => {
    const tx = makeTx({ transactionType: 'Etwas Unbekanntes' })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result.transaction_type).toBe('OTHER')
  })

  it('includes value_date and balance_after', () => {
    const tx = makeTx({ valuteDate: '2026-01-16', balanceAfter: 1234.56 })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result.value_date).toBe('2026-01-16')
    expect(result.balance_after).toBe(1234.56)
  })

  it('omits null optional fields', () => {
    const tx = makeTx({
      counterpartyName: null,
      counterpartyAddress: null,
      counterpartyIban: null,
      cardNumber: null,
      exchangeRate: null,
      exchangeTargetCurrency: null,
    })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result).not.toHaveProperty('counterparty_name')
    expect(result).not.toHaveProperty('counterparty_address')
    expect(result).not.toHaveProperty('counterparty_iban')
    expect(result).not.toHaveProperty('card_number')
    expect(result).not.toHaveProperty('exchange_rate')
    expect(result).not.toHaveProperty('exchange_target_currency')
  })

  it('does not include import metadata', () => {
    const tx = makeTx({ amount: -10 })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result).not.toHaveProperty('imported_at')
    expect(result).not.toHaveProperty('import_date')
    expect(result).not.toHaveProperty('import_id')
    expect(result).not.toHaveProperty('file_id')
  })

  it('handles negative balance', () => {
    const tx = makeTx({ balanceAfter: -21.62 })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result.balance_after).toBe(-21.62)
  })

  it('sets description from transactionType', () => {
    const tx = makeTx({ transactionType: 'Zahlung per Debitkarte' })
    const result = toWipTransaction(tx, 'DOC-1')
    expect(result.description).toBe('Zahlung per Debitkarte')
  })
})
