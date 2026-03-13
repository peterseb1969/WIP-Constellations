import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

export default function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  )
}
