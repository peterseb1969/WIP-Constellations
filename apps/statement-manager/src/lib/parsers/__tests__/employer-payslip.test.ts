import { describe, it, expect, vi } from 'vitest'

// Mock pdf-extract to avoid pdfjs-dist (needs DOMMatrix, browser-only)
vi.mock('../pdf-extract', () => ({
  extractPdfText: vi.fn(),
}))

import { toWipPayslip, toWipPayslipLine } from '../employer-payslip'
import type { ParsedEmployerPayslip, EmployerPayslipLine } from '../employer-payslip'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParsed(overrides: Partial<ParsedEmployerPayslip> = {}): ParsedEmployerPayslip {
  return {
    header: {
      employeeName: 'Peter Sebbel',
      employeeNumber: '10311897',
      siNumber: '756.3979.2688.93',
      capacityPercent: 100,
      payDate: '2025-11-25',
      period: '2025-11',
      periodLabel: 'November 2025',
      company: 'Employer AG',
    },
    lines: [
      { code: '1001', description: 'Monthly base salary', amount: 16417, isDeduction: false, basis: null, rate: null, category: 'BASE_SALARY' },
      { code: '2004', description: 'Child allowance', amount: 302.50, isDeduction: false, basis: 302.50, rate: null, category: 'ALLOWANCE' },
      { code: '/411', description: 'AHV contribution', amount: 872.20, isDeduction: true, basis: 16457, rate: 5.30, category: 'SOCIAL_CONTRIBUTION' },
      { code: '6103', description: 'PF Capital savings plan', amount: 161.30, isDeduction: true, basis: null, rate: null, category: 'PENSION' },
      { code: '4301', description: 'ESPP contribution', amount: 1641, isDeduction: true, basis: null, rate: null, category: 'ESPP' },
    ],
    summary: {
      gross: 17247,
      net: 16238.95,
      paymentAmount: 12812.90,
      totalSocialContributions: 1008.05,
      totalPensionContributions: 635.05,
      totalDeductions: 3426.05,
      currency: 'CHF',
      targetIban: 'CH790029329382280140A',
    },
    ...overrides,
  }
}

function makeLine(overrides: Partial<EmployerPayslipLine> = {}): EmployerPayslipLine {
  return {
    code: '1001',
    description: 'Monthly base salary',
    amount: 16417,
    isDeduction: false,
    basis: null,
    rate: null,
    category: 'BASE_SALARY',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// toWipPayslip
// ---------------------------------------------------------------------------

describe('toWipPayslip', () => {
  it('maps all summary fields', () => {
    const parsed = makeParsed()
    const result = toWipPayslip(parsed, 'DOC-EMPLOYER')

    expect(result.employer).toBe('DOC-EMPLOYER')
    expect(result.period).toBe('2025-11')
    expect(result.pay_date).toBe('2025-11-25')
    expect(result.currency).toBe('CHF')
    expect(result.gross).toBe(17247)
    expect(result.net).toBe(16238.95)
    expect(result.payment_amount).toBe(12812.90)
    expect(result.total_social_contributions).toBe(1008.05)
    expect(result.total_pension_contributions).toBe(635.05)
    expect(result.total_deductions).toBe(3426.05)
    expect(result.employee_number).toBe('10311897')
    expect(result.capacity_utilization).toBe(100)
    expect(result.target_iban).toBe('CH790029329382280140A')
  })

  it('does not include import metadata', () => {
    const result = toWipPayslip(makeParsed(), 'DOC-1')
    expect(result).not.toHaveProperty('imported_at')
    expect(result).not.toHaveProperty('import_date')
    expect(result).not.toHaveProperty('import_id')
    expect(result).not.toHaveProperty('file_id')
  })
})

// ---------------------------------------------------------------------------
// toWipPayslipLine
// ---------------------------------------------------------------------------

describe('toWipPayslipLine', () => {
  it('maps a base salary line', () => {
    const line = makeLine()
    const result = toWipPayslipLine(line, 'DOC-PAYSLIP')

    expect(result.payslip).toBe('DOC-PAYSLIP')
    expect(result.code).toBe('1001')
    expect(result.description).toBe('Monthly base salary')
    expect(result.category).toBe('BASE_SALARY')
    expect(result.amount).toBe(16417)
    expect(result.is_deduction).toBe(false)
    expect(result).not.toHaveProperty('basis')
    expect(result).not.toHaveProperty('rate')
  })

  it('maps a deduction with basis and rate', () => {
    const line = makeLine({
      code: '/411',
      description: 'AHV contribution',
      amount: 872.20,
      isDeduction: true,
      basis: 16457,
      rate: 5.30,
      category: 'SOCIAL_CONTRIBUTION',
    })
    const result = toWipPayslipLine(line, 'DOC-PAYSLIP')

    expect(result.is_deduction).toBe(true)
    expect(result.basis).toBe(16457)
    expect(result.rate).toBe(5.30)
    expect(result.category).toBe('SOCIAL_CONTRIBUTION')
  })

  it('maps ESPP line', () => {
    const line = makeLine({
      code: '4301',
      description: 'ESPP contribution',
      amount: 1641,
      isDeduction: true,
      category: 'ESPP',
    })
    const result = toWipPayslipLine(line, 'DOC-PAYSLIP')
    expect(result.category).toBe('ESPP')
    expect(result.is_deduction).toBe(true)
  })

  it('omits null basis and rate', () => {
    const line = makeLine({ basis: null, rate: null })
    const result = toWipPayslipLine(line, 'DOC-1')
    expect(result).not.toHaveProperty('basis')
    expect(result).not.toHaveProperty('rate')
  })

  it('includes basis and rate when present', () => {
    const line = makeLine({ basis: 12350, rate: 1.10 })
    const result = toWipPayslipLine(line, 'DOC-1')
    expect(result.basis).toBe(12350)
    expect(result.rate).toBe(1.10)
  })

  it('does not include import metadata', () => {
    const result = toWipPayslipLine(makeLine(), 'DOC-1')
    expect(result).not.toHaveProperty('imported_at')
    expect(result).not.toHaveProperty('import_date')
  })
})
