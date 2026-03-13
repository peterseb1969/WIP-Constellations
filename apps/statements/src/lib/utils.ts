import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatMonth(period: string): string {
  const [year, month] = period.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

/** Strip spaces, dashes, convert to uppercase for consistent IBAN comparison/storage. */
export function normalizeIban(iban: string): string {
  return iban.replace(/[\s-]/g, '').toUpperCase()
}
