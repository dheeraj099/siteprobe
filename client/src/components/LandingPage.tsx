import { useState } from 'react'
import type { Audit, AuditConfig } from '../types'
import { api } from '../api'

interface Props {
  onAuditCreated: (audit: Audit) => void
  pastAudits: Audit[]
  onSelectAudit: (id: string) => void
  onDeleteAudit: (id: string) => void
}

const DEFAULT_CONFIG: Partial<AuditConfig> = {
  maxPages: 20,
  maxDepth: 3,
  includePerformance: true,
  includeAccessibility: true,
  includeSeo: true,
  includeSecurity: true,
  respectRobotsTxt: true,
}

const FEATURES = [
  { icon: '⚡', label: 'Performance', desc: 'LCP · FCP · CLS · TBT · TTFB' },
  { icon: '♿', label: 'Accessibility', desc: 'WCAG 2.1 AA via axe-core' },
  { icon: '🔍', label: 'SEO', desc: 'Meta · headings · structured data' },
  { icon: '🔒', label: 'Security', desc: 'HSTS · CSP · headers audit' },
]

function statusChip(s: Audit['status']) {
  const map: Record<string, string> = {
    complete: 'bg-green-50 text-green-700 ring-green-200',
    failed:   'bg-red-50 text-red-700 ring-red-200',
    crawling: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    auditing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    queued:   'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${map[s] ?? map.queued}`
}

export default function LandingPage({ onAuditCreated, pastAudits, onSelectAudit, onDeleteAudit }: Props) {
  const [url, setUrl] = useState('')
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let normalized = url.trim()
    if (!normalized) { setError('Please enter a URL to audit'); return }
    if (!normalized.startsWith('http')) normalized = 'https://' + normalized
    setLoading(true)
    try {
      const audit = await api.createAudit(normalized, config)
      onAuditCreated(audit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">SiteProbe</span>
          <span className="text-xs text-slate-400 font-medium hidden sm:block">Full-Site Audit Platform</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-10 fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-5 ring-1 ring-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Free full-site audit — no sign-up required
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            Audit your entire website<br className="hidden sm:block" /> in one click
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed">
            Enter a URL and SiteProbe crawls every page — analyzing performance, accessibility, SEO and security issues across your whole site.
          </p>
        </div>

        {/* Input card */}
        <div className="w-full max-w-2xl fade-up" style={{ animationDelay: '0.08s' }}>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
              >
                {loading ? (
                  <><span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />Starting…</>
                ) : 'Start Audit'}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </p>
            )}

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-4 text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {showAdvanced ? 'Hide' : 'Show'} advanced options
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {([['maxPages', 'Max Pages', 1, 200], ['maxDepth', 'Max Depth', 1, 10]] as const).map(([key, label, min, max]) => (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-500">{label}</span>
                      <input
                        type="number" min={min} max={max}
                        value={(config[key] as number) ?? (key === 'maxPages' ? 20 : 3)}
                        onChange={(e) => setConfig((c) => ({ ...c, [key]: parseInt(e.target.value) || (key === 'maxPages' ? 20 : 3) }))}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['includePerformance', 'includeAccessibility', 'includeSeo', 'includeSecurity', 'respectRobotsTxt'] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${config[key] ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}
                        onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}>
                        {config[key] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                        {key.replace('include', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Disclaimer */}
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
            <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong className="font-semibold">Responsible use:</strong> Only audit websites you own or have explicit permission to test. SiteProbe sends real browser requests that may appear in analytics and consume server resources.
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full mt-10 fade-up" style={{ animationDelay: '0.14s' }}>
          {FEATURES.map(({ icon, label, desc }) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="text-xl mb-2">{icon}</div>
              <div className="text-sm font-semibold text-slate-800">{label}</div>
              <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Past audits */}
      {pastAudits.length > 0 && (
        <section className="border-t border-slate-200 bg-white px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Recent Audits</h2>
            <div className="divide-y divide-slate-100">
              {pastAudits.slice(0, 8).map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center gap-4 py-3 cursor-pointer group hover:bg-slate-50 -mx-3 px-3 rounded-lg transition-colors"
                  onClick={() => onSelectAudit(audit.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{audit.url}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(audit.createdAt).toLocaleDateString()} · {audit.crawledPages} pages crawled
                    </div>
                  </div>
                  <span className={statusChip(audit.status)}>{audit.status}</span>
                  {audit.scoreOverall != null && (
                    <span className="text-sm font-bold text-slate-700 tabular-nums w-10 text-right">{audit.scoreOverall}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteAudit(audit.id) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-1 rounded"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
