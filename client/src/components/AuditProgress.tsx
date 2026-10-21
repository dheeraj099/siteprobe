import { useEffect, useRef, useState } from 'react'
import type { Audit } from '../types'
import { api } from '../api'

interface Props {
  auditId: string
  onComplete: (audit: Audit) => void
  onBack: () => void
}

interface LogEntry { type: string; url?: string; message?: string; timestamp: number }

const TYPE_STYLE: Record<string, string> = {
  error:    'text-red-500',
  complete: 'text-green-600',
  audited:  'text-indigo-600',
  crawled:  'text-slate-500',
  status:   'text-slate-400',
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
        setAudit((p) => p ? { ...p, status: event as Audit['status'] } : p)
        onComplete(d as unknown as Audit)
      }
      if (event !== 'progress' && event !== 'init') {
        setLog((p) => [...p.slice(-199), { type: event, url: d.url as string, message: d.message as string, timestamp: (d.timestamp as number) ?? Date.now() }])
      }
    })
    return cleanup
  }, [auditId, onComplete])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  if (!audit) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <span className="spin w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full inline-block" />
        Connecting…
      </div>
    </div>
  )

  const isRunning = audit.status === 'crawling' || audit.status === 'auditing' || audit.status === 'queued'
  const total = audit.totalPages || audit.crawledPages || 1
  const crawledPct = Math.min(100, Math.round((audit.crawledPages / total) * 100))
  const auditedPct = Math.min(100, Math.round((audit.auditedPages / total) * 100))

  const statusConfig = {
    complete: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200', dot: 'bg-green-500' },
    failed:   { bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200',   dot: 'bg-red-500' },
    crawling: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
    auditing: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
    queued:   { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', dot: 'bg-slate-400' },
  }
  const sc = statusConfig[audit.status] ?? statusConfig.queued

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <span className="text-sm text-slate-600 truncate flex-1">{audit.url}</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${sc.bg} ${sc.text} ${sc.ring}`}>
            {isRunning && <span className={`pulse-dot w-1.5 h-1.5 rounded-full ${sc.dot}`} />}
            {audit.status}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Discovered', value: audit.totalPages || '—', icon: '🗺️' },
            { label: 'Crawled',    value: audit.crawledPages,       icon: '🕷️' },
            { label: 'Audited',    value: audit.auditedPages,       icon: '✅' },
            { label: 'Failed',     value: audit.failedPages,        icon: '⚠️' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Progress</h2>
          {[
            { label: 'Crawl', pct: crawledPct, color: 'bg-indigo-500' },
            { label: 'Audit', pct: auditedPct, color: 'bg-green-500' },
          ].map(({ label, pct, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{label}</span><span className="font-medium">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
          {audit.status === 'failed' && audit.error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {audit.error}
            </div>
          )}
        </div>

        {/* Live log */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Live Log</span>
            {isRunning && <span className="flex items-center gap-1.5 text-xs text-indigo-600"><span className="pulse-dot w-1.5 h-1.5 rounded-full bg-indigo-500" />Running</span>}
          </div>
          <div ref={logRef} className="h-60 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-slate-50">
            {log.length === 0 && <div className="text-slate-300 text-center py-6">Waiting for events…</div>}
            {log.map((entry, i) => (
              <div key={i} className={`flex gap-3 ${TYPE_STYLE[entry.type] ?? 'text-slate-500'}`}>
                <span className="text-slate-300 shrink-0 tabular-nums">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="uppercase w-12 shrink-0 font-semibold">[{entry.type}]</span>
                <span className="truncate">{entry.url ?? entry.message ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
