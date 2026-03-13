import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="w-12 h-12 text-text-muted mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-text-muted mb-4">{description}</p>}
      {action}
    </div>
  )
}
