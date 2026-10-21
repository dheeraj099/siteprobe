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

function statusColor(s: Audit['status']) {
  if (s === 'complete') return 'text-green-400'
  if (s === 'failed') return 'text-red-400'
  if (s === 'crawling' || s === 'auditing') return 'text-violet-400'
  return 'text-zinc-400'
}

function scoreLabel(s: number | undefined) {
  if (s == null) return '—'
  return `${s}/100`
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
    if (!url.trim()) { setError('Please enter a URL'); return }
    let normalized = url.trim()
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

  function toggle(key: keyof AuditConfig) {
    setConfig((c) => ({ ...c, [key]: !c[key as keyof typeof c] }))
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1c1c26] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <span className="font-bold text-lg tracking-tight text-white">SiteProbe</span>
        <span className="text-xs text-[#5555aa] ml-1">Full-Site Audit Platform</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
            Audit your entire website in one click
          </h1>
          <p className="text-[#8888aa] text-lg">
            Crawl every page and analyze performance, accessibility, SEO, and security issues across your whole site.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-4 py-3 rounded-lg bg-[#111118] border border-[#2d2d42] text-white placeholder-[#4a4a6a] focus:outline-none focus:border-violet-500 text-base"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors text-base whitespace-nowrap"
            >
              {loading ? 'Starting...' : 'Start Audit'}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-3 text-sm text-[#6666aa] hover:text-violet-400 transition-colors"
          >
            {showAdvanced ? '▲ Hide' : '▼ Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="mt-4 p-4 rounded-lg bg-[#111118] border border-[#1c1c26] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[#8888aa]">Max Pages</span>
                  <input
                    type="number" min={1} max={200}
                    value={config.maxPages ?? 20}
                    onChange={(e) => setConfig((c) => ({ ...c, maxPages: parseInt(e.target.value) || 20 }))}
                    className="px-3 py-2 rounded bg-[#1c1c26] border border-[#2d2d42] text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[#8888aa]">Max Depth</span>
                  <input
                    type="number" min={1} max={10}
                    value={config.maxDepth ?? 3}
                    onChange={(e) => setConfig((c) => ({ ...c, maxDepth: parseInt(e.target.value) || 3 }))}
                    className="px-3 py-2 rounded bg-[#1c1c26] border border-[#2d2d42] text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['includePerformance', 'includeAccessibility', 'includeSeo', 'includeSecurity', 'respectRobotsTxt'] as const).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config[key] ?? true}
                      onChange={() => toggle(key)}
                      className="accent-violet-500"
                    />
                    <span className="text-xs text-[#aaaacc]">
                      {key.replace('include', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Category badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {[
            { label: 'Performance', icon: '⚡' },
            { label: 'Accessibility', icon: '♿' },
            { label: 'SEO', icon: '🔍' },
            { label: 'Security', icon: '🔒' },
            { label: 'Full Crawl', icon: '🕷️' },
          ].map(({ label, icon }) => (
            <span key={label} className="px-3 py-1 rounded-full bg-[#1c1c26] border border-[#2d2d42] text-xs text-[#8888aa]">
              {icon} {label}
            </span>
          ))}
        </div>
      </main>

      {/* Past audits */}
      {pastAudits.length > 0 && (
        <section className="border-t border-[#1c1c26] px-6 py-6 max-w-4xl mx-auto w-full">
          <h2 className="text-sm font-semibold text-[#8888aa] uppercase tracking-wide mb-4">Recent Audits</h2>
          <div className="space-y-2">
            {pastAudits.slice(0, 8).map((audit) => (
              <div
                key={audit.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-[#111118] border border-[#1c1c26] hover:border-[#2d2d42] transition-colors cursor-pointer group"
                onClick={() => onSelectAudit(audit.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{audit.url}</div>
                  <div className="text-xs text-[#5555aa] mt-0.5">
                    {new Date(audit.createdAt).toLocaleDateString()} · {audit.crawledPages} pages
                  </div>
                </div>
                <span className={`text-xs font-medium capitalize ${statusColor(audit.status)}`}>{audit.status}</span>
                {audit.scoreOverall != null && (
                  <span className="text-xs text-violet-300 font-mono">{scoreLabel(audit.scoreOverall)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteAudit(audit.id) }}
                  className="text-[#3a3a5a] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm px-1"
                  title="Delete audit"
                >✕</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
