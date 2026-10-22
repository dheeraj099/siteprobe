import { useEffect, useRef, useState } from 'react'
import type { Audit } from '../types'
import { api } from '../api'

interface Props {
  auditId: string
  onComplete: (audit: Audit) => void
  onBack: () => void
}

interface LogEntry { type: string; url?: string; message?: string; timestamp: number }

const LOG_COLOR: Record<string, string> = {
  error:    '#dc2626',
  complete: '#16a34a',
  audited:  '#2456d6',
  crawled:  '#6b7280',
  status:   '#9ca3af',
}

function statusStyle(s: Audit['status']): { bg: string; text: string; border: string; dot: string } {
  const map: Record<string, ReturnType<typeof statusStyle>> = {
    complete: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#16a34a' },
    failed:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444' },
    crawling: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#2456d6' },
    auditing: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#2456d6' },
    queued:   { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb', dot: '#9ca3af' },
  }
  return map[s] ?? map.queued
}

const STAT_ICONS = {
  Discovered: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2456d6" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Crawled: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Audited: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Failed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
}

export default function AuditProgress({ auditId, onComplete, onBack }: Props) {
  const [audit, setAudit] = useState<Audit | null>(null)
  const [log,   setLog]   = useState<LogEntry[]>([])
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
        setAudit(p => p ? { ...p, status: event as Audit['status'] } : p)
        onComplete(d as unknown as Audit)
      }
      if (event !== 'progress' && event !== 'init') {
        setLog(p => [...p.slice(-199), {
          type: event,
          url: d.url as string,
          message: d.message as string,
          timestamp: (d.timestamp as number) ?? Date.now(),
        }])
      }
    })
    return cleanup
  }, [auditId, onComplete])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  if (!audit) return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--muted)', fontFamily: 'var(--font)', fontSize: '15px' }}>
        <span className="spin" style={{ width: 16, height: 16, border: '2px solid var(--surface)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
        Connecting…
      </div>
    </div>
  )

  const isRunning = audit.status === 'crawling' || audit.status === 'auditing' || audit.status === 'queued'
  const total      = audit.totalPages || audit.crawledPages || 1
  const crawledPct = Math.min(100, Math.round((audit.crawledPages / total) * 100))
  const auditedPct = Math.min(100, Math.round((audit.auditedPages / total) * 100))
  const sc = statusStyle(audit.status)

  const innerWrap: React.CSSProperties = { maxWidth: '1200px', margin: '0 auto' }
  const card: React.CSSProperties = {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid rgba(0,0,0,0.07)',
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)', color: 'var(--ink)' }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 var(--margin)' }}>
        <div style={{ ...innerWrap, display: 'flex', alignItems: 'center', height: '60px', gap: '16px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.03em' }}>SiteProbe</span>
          </div>

          {/* Divider */}
          <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)', flexShrink: 0 }} />

          {/* Back */}
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: '4px 0', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>

          {/* Divider */}
          <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)', flexShrink: 0 }} />

          {/* URL */}
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {audit.url}
          </span>

          {/* Status badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '999px',
            fontSize: '12px', fontWeight: 600,
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            flexShrink: 0,
          }}>
            {isRunning && (
              <span className="crawl-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
            )}
            {audit.status}
          </span>
        </div>
      </header>

      {/* ── CONTENT ────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: 'clamp(32px, 5vw, 56px) var(--margin)' }}>
        <div style={{ ...innerWrap, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '16px' }}>
            {([
              { label: 'Discovered', value: audit.totalPages || '—' },
              { label: 'Crawled',    value: audit.crawledPages      },
              { label: 'Audited',    value: audit.auditedPages      },
              { label: 'Failed',     value: audit.failedPages       },
            ] as { label: keyof typeof STAT_ICONS; value: number | string }[]).map(({ label, value }) => (
              <div key={label} style={{ ...card, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {STAT_ICONS[label]}
                </div>
                <div style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)', fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 'var(--step-small)', color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ ...card, padding: '28px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '20px' }}>Progress</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Crawl', pct: crawledPct, color: 'var(--accent)' },
                { label: 'Audit', pct: auditedPct, color: '#16a34a'       },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: '999px', background: 'var(--surface)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: color, width: `${pct}%`, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {audit.status === 'failed' && audit.error && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', padding: '14px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#dc2626' }}>
                <svg style={{ flexShrink: 0, marginTop: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {audit.error}
              </div>
            )}
          </div>

          {/* Live log */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Log</span>
              {isRunning && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                  <span className="crawl-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                  Running
                </span>
              )}
            </div>
            <div
              ref={logRef}
              style={{ height: 280, overflowY: 'auto', padding: '16px 24px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {log.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '13px', fontFamily: 'monospace' }}>
                  Waiting for events…
                </div>
              )}
              {log.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}>
                  <span style={{ color: 'rgba(0,0,0,0.25)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: LOG_COLOR[entry.type] ?? 'var(--muted)', flexShrink: 0, width: 56, fontWeight: 600 }}>
                    [{entry.type}]
                  </span>
                  <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.url ?? entry.message ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
