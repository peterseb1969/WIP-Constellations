import { useState, useCallback } from 'react'
import { Upload, FileDown, CheckCircle, AlertCircle, Clock, File } from 'lucide-react'
import { useDocuments, useDownloadUrl } from '@wip/react'
import type { Document } from '@wip/client'
import { cn, formatDate } from '@/lib/utils'

function DownloadButton({ fileId, filename }: { fileId: string; filename: string }) {
  const { isLoading, refetch } = useDownloadUrl(fileId)

  async function handleDownload() {
    const result = await refetch()
    const url = result.data?.download_url
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className="flex items-center gap-1 text-primary text-sm hover:underline disabled:opacity-50"
      title="Download original file"
    >
      <FileDown size={14} />
      Download
    </button>
  )
}

function ImportHistoryItem({ doc }: { doc: Document }) {
  const d = doc.data as Record<string, unknown>
  const status = d.status as string
  const fileId = d.file as string | undefined
  const filename = d.filename as string

  const StatusIcon = status === 'success' ? CheckCircle : status === 'failed' ? AlertCircle : Clock
  const statusColor = status === 'success' ? 'text-success' : status === 'failed' ? 'text-danger' : 'text-accent'

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <StatusIcon size={18} className={statusColor} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <div className="flex gap-3 text-xs text-text-muted mt-0.5">
          <span>{formatDate(d.import_date as string)}</span>
          <span>{d.document_type as string}</span>
          <span>{d.parser as string}</span>
          <span>{d.transactions_created as number} items created</span>
        </div>
      </div>
      <span className={cn('text-xs font-medium px-2 py-0.5 rounded', {
        'bg-success/10 text-success': status === 'success',
        'bg-danger/10 text-danger': status === 'failed',
        'bg-accent/10 text-accent': status === 'partial',
      })}>
        {status}
      </span>
      {fileId && <DownloadButton fileId={fileId} filename={filename} />}
    </div>
  )
}

export function ImportPage() {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: importData, isLoading } = useDocuments({
    template_value: 'FIN_IMPORT',
    page_size: 50,
  })

  const imports = importData?.items ?? []

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-primary" />
        <h2 className="text-2xl font-semibold">Import</h2>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6',
          dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400',
        )}
      >
        {selectedFile ? (
          <div className="space-y-3">
            <File size={32} className="mx-auto text-primary" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-text-muted">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Preview & Import
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={32} className="mx-auto text-text-muted" />
            <div>
              <p className="font-medium">Drop a file here or click to browse</p>
              <p className="text-sm text-text-muted mt-1">
                Supports UBS CSV statements and Roche payslip PDFs
              </p>
            </div>
            <label className="inline-block px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 cursor-pointer">
              Choose File
              <input
                type="file"
                accept=".csv,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Import history */}
      <div className="bg-surface border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-lg mb-4">Import History</h3>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!isLoading && imports.length === 0 && (
          <p className="text-text-muted text-sm py-4">No imports yet.</p>
        )}

        {!isLoading && imports.length > 0 && (
          <div>
            {imports.map((doc) => (
              <ImportHistoryItem key={doc.document_id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
