import { AlertTriangle, RefreshCw } from 'lucide-react'
import { WipError, WipNetworkError, WipValidationError } from '@wip/client'

interface ErrorBannerProps {
  error: Error
  onRetry?: () => void
}

function getErrorMessage(error: Error): string {
  if (error instanceof WipNetworkError) {
    return 'Cannot reach the server. Check your network connection.'
  }
  if (error instanceof WipValidationError) {
    return `Validation error: ${error.message}`
  }
  if (error instanceof WipError) {
    const detail = error.detail ? ` (${JSON.stringify(error.detail)})` : ''
    return `${error.message}${detail}`
  }
  return error.message || 'Something went wrong. Please try again in a moment.'
}

export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  // Always log full error for debugging
  console.error('[Statement Manager]', error)

  return (
    <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{getErrorMessage(error)}</p>
        {error instanceof WipError && error.statusCode && (
          <p className="text-xs mt-1 opacity-70">HTTP {error.statusCode}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  )
}
