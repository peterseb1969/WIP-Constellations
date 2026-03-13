import { cn } from '../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-surface rounded-lg border p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h3 className={cn('text-sm font-semibold text-text-muted uppercase tracking-wide mb-2', className)}>
      {children}
    </h3>
  )
}

export function CardValue({ children, className }: CardProps) {
  return (
    <div className={cn('text-2xl font-bold text-text-primary', className)}>
      {children}
    </div>
  )
}
