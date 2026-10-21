import { useEffect, useRef, useState } from 'react'
import type { Audit } from '../types'
import { api } from '../api'

interface Props {
  auditId: string
  onComplete: (audit: Audit) => void
  onBack: () => void
}

interface LogEntry {
  type: string
  url?: string
  message?: string
  timestamp: number
}

export default function AuditProgress({ auditId, onComplete, onBack }: Props) {
  const [audit, setAudit] = useState<Audit | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cleanup = api.streamProgress(auditId, (event, data) => {
      const d = data as Record<string, unknown>

      if (event === 'init' || event === 'progress') {
        setAudit(d as unknown as Audit)
        if ((d.status === 'complete' || d.status === 'failed') && event === 'progress') {
          onComplete(d as unknown as Audit)
        }
      }

      if (event === 'complete' || event === 'failed') {
        setAudit((prev) => prev ? { ...prev, status: event as Audit['status'] } : prev)
        onComplete(d as unknown as Audit)
      }

      if (event !== 'progress' && event !== 'init') {
        setLog((prev) => [
          ...prev.slice(-199),
          { type: event, url: d.url as string, message: d.message as string, timestamp: d.timestamp as number ?? Date.now() },
        ])
      }
    })
    return cleanup
  }, [auditId, onComplete])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  if (!audit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#5555aa]">Connecting to audit stream...</div>
      </div>
    )
  }

  const total = audit.totalPages || audit.crawledPages || 1
  const auditedPct = Math.min(100, Math.round((audit.auditedPages / total) * 100))
  const crawledPct = Math.min(100, Math.round((audit.crawledPages / (audit.totalPages || audit.crawledPages || 1)) * 100))

  const isRunning = audit.status === 'crawling' || audit.status === 'auditing' || audit.status === 'queued'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#1c1c26] px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-[#5555aa] hover:text-white transition-colors text-sm">← Back</button>
        <div className="w-px h-4 bg-[#1c1c26]" />
        <span className="text-sm text-[#8888aa] truncate">{audit.url}</span>
        <div className="ml-auto flex items-center gap-2">
          {isRunning && <span className="pulse-dot w-2 h-2 rounded-full bg-violet-500" />}
          <span className={`text-sm font-medium capitalize ${audit.status === 'complete' ? 'text-green-400' : audit.status === 'failed' ? 'text-red-400' : 'text-violet-400'}`}>
            {audit.status}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Status card */}
        <div className="p-6 rounded-xl bg-[#111118] border border-[#1c1c26]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Audit Progress</h2>
            <span className="text-sm text-[#5555aa]">ID: {audit.id.slice(0, 12)}...</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Discovered', value: audit.totalPages || '...' },
              { label: 'Pages Crawled', value: audit.crawledPages },
              { label: 'Pages Audited', value: audit.auditedPages },
              { label: 'Failed', value: audit.failedPages },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-[#5555aa] mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#5555aa] mb-1">
                <span>Crawl Progress</span><span>{crawledPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#1c1c26]">
                <div className="h-2 rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${crawledPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#5555aa] mb-1">
                <span>Audit Progress</span><span>{auditedPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#1c1c26]">
                <div className="h-2 rounded-full bg-green-600 transition-all duration-500" style={{ width: `${auditedPct}%` }} />
              </div>
            </div>
          </div>

          {audit.status === 'failed' && audit.error && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">
              {audit.error}
            </div>
          )}
        </div>

        {/* Live log */}
        <div className="rounded-xl bg-[#111118] border border-[#1c1c26]">
          <div className="px-4 py-3 border-b border-[#1c1c26] flex items-center gap-2">
            <span className="text-sm font-medium text-white">Live Log</span>
            {isRunning && <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-violet-500" />}
          </div>
          <div ref={logRef} className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-1">
            {log.length === 0 && <div className="text-[#3a3a5a]">Waiting for events...</div>}
            {log.map((entry, i) => (
              <div key={i} className={`flex gap-2 ${entry.type === 'error' ? 'text-red-400' : entry.type === 'complete' ? 'text-green-400' : entry.type === 'audited' ? 'text-violet-300' : 'text-[#6666aa]'}`}>
                <span className="text-[#3a3a5a] shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="shrink-0 uppercase w-12">[{entry.type}]</span>
                <span className="truncate">{entry.url ?? entry.message ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
