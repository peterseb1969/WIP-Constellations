import { useTerminologies, useTerms } from '@wip/react'

interface TermSelectProps {
  terminologyValue: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function TermSelect({
  terminologyValue,
  value,
  onChange,
  placeholder = 'Select...',
  required,
  className = '',
}: TermSelectProps) {
  const { data: terminologies } = useTerminologies({ value: terminologyValue })
  const terminologyId = terminologies?.items?.[0]?.terminology_id ?? ''

  const { data: termsData, isLoading } = useTerms(terminologyId, {
    page_size: 100,
  })

  const terms = termsData?.items ?? []

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={isLoading}
      className={`block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 ${className}`}
    >
      <option value="">{isLoading ? 'Loading...' : placeholder}</option>
      {terms.map((term) => (
        <option key={term.term_id} value={term.value}>
          {term.label}
        </option>
      ))}
    </select>
  )
}
