import { useState } from 'react'
import type { Audit, AuditConfig } from '../types'
import { api } from '../api'

/* ─── Props ──────────────────────────────────────────────── */

interface Props {
  onAuditCreated: (audit: Audit) => void
  pastAudits: Audit[]
  onSelectAudit: (id: string) => void
  onDeleteAudit: (id: string) => void
}

/* ─── Static data ────────────────────────────────────────── */

const DEFAULT_CONFIG: Partial<AuditConfig> = {
  maxPages: 20,
  maxDepth: 3,
  includePerformance: true,
  includeAccessibility: true,
  includeSeo: true,
  includeSecurity: true,
  respectRobotsTxt: true,
}

const STATS = [
  { num: '200+', label: 'Pages per crawl' },
  { num: '4',    label: 'Audit categories' },
  { num: '100%', label: 'Free, no signup'  },
]

const FEATURES = [
  {
    label: 'Performance',
    desc: 'Core Web Vitals on every page — LCP, FCP, CLS, TBT, and TTFB measured with a real browser.',
    color: 'text-amber-600 bg-amber-50',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    label: 'Accessibility',
    desc: 'WCAG 2.1 AA compliance checks powered by axe-core, running against every crawled page.',
    color: 'text-violet-600 bg-violet-50',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 22v-8m0 0l-4 4m4-4l4 4M8.5 12l-3-4.5 3.5.5 3-1 3 1 3.5-.5-3 4.5"/>
      </svg>
    ),
  },
  {
    label: 'SEO',
    desc: 'Meta tags, Open Graph, canonical URLs, heading hierarchy, and structured data checks.',
    color: 'text-sky-600 bg-sky-50',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    label: 'Security',
    desc: 'HSTS, Content-Security-Policy, X-Frame-Options, and other critical security headers.',
    color: 'text-emerald-600 bg-emerald-50',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Enter your URL',
    desc: 'Paste any public website URL. SiteProbe automatically adds https:// if needed.',
  },
  {
    n: '02',
    title: 'We crawl every page',
    desc: 'The crawler follows internal links using breadth-first search, respecting your depth and page limits.',
  },
  {
    n: '03',
    title: 'Get your full report',
    desc: 'Review scores, Core Web Vitals, and prioritised issues grouped by severity across all four categories.',
  },
]

/* ─── Helpers ────────────────────────────────────────────── */

function statusCls(s: Audit['status']): string {
  const map: Record<string, string> = {
    complete: 'bg-green-50 text-green-700 ring-green-200',
    failed:   'bg-red-50 text-red-700 ring-red-200',
    crawling: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    auditing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    queued:   'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${map[s] ?? map.queued}`
}

/* ─── Decorative preview components (aria-hidden) ─────────── */

/** Simulated performance report preview */
function PerformancePreview() {
  // SVG arc: r=36, circ≈226.2, score=87 → dash=196.8
  const PERF_METRICS = [
    { label: 'LCP',  val: '2.1s',  pct: 53, cls: 'bg-amber-400' },
    { label: 'FCP',  val: '1.3s',  pct: 43, cls: 'bg-green-500' },
    { label: 'CLS',  val: '0.08',  pct: 32, cls: 'bg-green-500' },
    { label: 'TBT',  val: '180ms', pct: 30, cls: 'bg-amber-400' },
    { label: 'TTFB', val: '210ms', pct: 26, cls: 'bg-green-500' },
  ]
  return (
    <div
      className="bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      aria-hidden="true"
    >
      {/* Fake browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
        </div>
        <div className="flex-1 mx-3 h-5 bg-white rounded border border-slate-200 flex items-center px-2.5 gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div className="h-2 bg-slate-200 rounded-full w-32" />
        </div>
      </div>
      {/* Content */}
      <div className="p-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Performance Overview</p>
        <div className="flex items-center gap-5">
          {/* Score ring */}
          <div className="shrink-0">
            <svg width="88" height="88" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="36" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle
                cx="45" cy="45" r="36" fill="none"
                stroke="#22c55e" strokeWidth="7"
                strokeDasharray="196.8 29.4"
                strokeLinecap="round"
                transform="rotate(-90 45 45)"
              />
              <text x="45" y="42" textAnchor="middle" fontSize="19" fontWeight="700" fill="#1E1B4B">87</text>
              <text x="45" y="57" textAnchor="middle" fontSize="10" fill="#94a3b8">Score</text>
            </svg>
          </div>
          {/* Metric bars */}
          <div className="flex-1 space-y-2">
            {PERF_METRICS.map(({ label, val, pct, cls }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 w-9 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                  <div className={`h-1.5 rounded-full ${cls}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-mono text-slate-600 w-12 text-right shrink-0">{val}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Footer stats */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-around">
          {[
            { v: '24', l: 'Pages audited' },
            { v: '8',  l: 'Issues found'  },
            { v: '2',  l: 'Critical'      },
          ].map(({ v, l }) => (
            <div key={l} className="text-center">
              <div className="text-base font-bold text-[#1E1B4B]">{v}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Simulated accessibility + SEO issue list preview */
function IssuePreview() {
  const ISSUES = [
    { icon: '♿', sev: 'critical', cls: 'bg-red-50 text-red-600',    title: 'Images missing alt text'         },
    { icon: '🔍', sev: 'high',     cls: 'bg-orange-50 text-orange-600', title: 'Missing meta description'     },
    { icon: '♿', sev: 'medium',   cls: 'bg-amber-50 text-amber-700',  title: 'Insufficient color contrast'   },
    { icon: '🔍', sev: 'medium',   cls: 'bg-amber-50 text-amber-700',  title: 'Duplicate H1 tags found'       },
    { icon: '♿', sev: 'low',      cls: 'bg-blue-50 text-blue-600',    title: 'Form fields missing labels'     },
  ]
  return (
    <div
      className="bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <span className="text-sm font-semibold text-[#1E1B4B]">Audit Issues</span>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">21 found</span>
      </div>
      <div className="divide-y divide-slate-50">
        {ISSUES.map((issue) => (
          <div key={issue.title} className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm shrink-0 leading-none">{issue.icon}</span>
            <span className="flex-1 min-w-0 text-xs text-slate-700 truncate">{issue.title}</span>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${issue.cls}`}>
              {issue.sev}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-1.5 w-[38%] rounded-full bg-indigo-500" />
          </div>
          <span className="text-[11px] text-slate-500 shrink-0">38% issues addressed</span>
        </div>
      </div>
    </div>
  )
}

/** Simulated security header check preview */
function SecurityPreview() {
  type CheckStatus = 'pass' | 'fail' | 'warn'
  const CHECKS: { name: string; status: CheckStatus }[] = [
    { name: 'Strict-Transport-Security', status: 'pass' },
    { name: 'X-Frame-Options',           status: 'pass' },
    { name: 'Content-Security-Policy',   status: 'fail' },
    { name: 'Permissions-Policy',        status: 'fail' },
    { name: 'X-Content-Type-Options',    status: 'pass' },
    { name: 'Referrer-Policy',           status: 'warn' },
  ]
  const CFG: Record<CheckStatus, { dot: string; label: string; txt: string }> = {
    pass: { dot: 'bg-green-500', label: 'Enabled',  txt: 'text-green-600'  },
    fail: { dot: 'bg-red-400',   label: 'Missing',  txt: 'text-red-500'    },
    warn: { dot: 'bg-amber-400', label: 'Weak',     txt: 'text-amber-600'  },
  }
  const pass = CHECKS.filter((c) => c.status === 'pass').length
  const fail = CHECKS.filter((c) => c.status === 'fail').length
  return (
    <div
      className="bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <span className="text-sm font-semibold text-[#1E1B4B]">Security Headers</span>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1 text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{pass} pass
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />{fail} fail
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {CHECKS.map(({ name, status }) => {
          const c = CFG[status]
          return (
            <div key={name} className="flex items-center gap-3 px-5 py-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
              <span className="flex-1 min-w-0 text-xs font-mono text-slate-600 truncate">{name}</span>
              <span className={`text-[11px] font-semibold shrink-0 ${c.txt}`}>{c.label}</span>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100">
        <p className="text-[11px] text-slate-400">
          3 of 6 critical headers present · <span className="text-red-500 font-medium">2 missing headers detected</span>
        </p>
      </div>
    </div>
  )
}

/* ─── PillForm ───────────────────────────────────────────── */

interface PillFormProps {
  onAuditCreated: (audit: Audit) => void
  config: Partial<AuditConfig>
  dark?: boolean
}

function PillForm({ onAuditCreated, config, dark = false }: PillFormProps) {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div
        className={`flex items-center w-full gap-1.5 p-1.5 rounded-full border ${
          dark
            ? 'bg-white/10 border-white/20 shadow-lg shadow-black/30'
            : 'bg-white border-indigo-100 shadow-lg shadow-indigo-100/50'
        }`}
      >
        <label htmlFor={dark ? 'url-cta' : 'url-hero'} className="sr-only">Website URL</label>
        <input
          id={dark ? 'url-cta' : 'url-hero'}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yoursite.com"
          disabled={loading}
          autoComplete="url"
          className={`flex-1 min-w-0 px-5 py-2.5 rounded-full bg-transparent text-sm focus:outline-none placeholder-slate-400 ${
            dark ? 'text-white placeholder-indigo-300' : 'text-[#1E1B4B]'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-60 text-white font-semibold text-sm transition-all whitespace-nowrap"
        >
          {loading ? (
            <><span className="spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />Auditing…</>
          ) : 'Audit site →'}
        </button>
      </div>
      {error && (
        <p role="alert" className={`mt-2 flex items-center gap-1.5 text-xs pl-2 ${dark ? 'text-red-300' : 'text-red-600'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </p>
      )}
    </form>
  )
}

/* ─── Shared sub-section heading ─────────────────────────── */

function ShowcaseText({
  label, labelColor, heading, body, bullets,
}: {
  label: string
  labelColor: string
  heading: string
  body: string
  bullets: string[]
}) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${labelColor}`}>{label}</p>
      <h2 className="text-2xl sm:text-3xl font-bold text-[#1E1B4B] leading-snug mb-5">
        {heading}
      </h2>
      <p className="text-slate-600 leading-relaxed mb-7 text-[15px]">{body}</p>
      <ul className="space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-slate-600">
            <svg className="mt-0.5 shrink-0 text-indigo-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────── */

export default function LandingPage({ onAuditCreated, pastAudits, onSelectAudit, onDeleteAudit }: Props) {
  const [config, setConfig]           = useState<Partial<AuditConfig>>(DEFAULT_CONFIG)
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <span className="font-bold text-[#1E1B4B] text-sm tracking-tight">SiteProbe</span>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:block">Free · No account needed</span>
        </div>
      </header>

      <main className="flex-1 w-full">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="w-full bg-[#F5F3FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
            <div className="max-w-2xl mx-auto text-center mb-10 fade-up">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 border border-indigo-200/80 text-indigo-700 text-xs font-semibold mb-8">
                <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Fully automated · Crawls every page
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-[#1E1B4B] leading-[1.12] tracking-tight mb-5">
                Run a full website audit<br className="hidden sm:block" /> in minutes
              </h1>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                Find issues impacting performance, accessibility, SEO, and security — across every page of your site, automatically.
              </p>
            </div>

            <div className="max-w-xl mx-auto w-full fade-up" style={{ animationDelay: '0.07s' }}>
              <PillForm onAuditCreated={onAuditCreated} config={config} />
              <p className="mt-3.5 text-center text-[11px] text-slate-400">
                Free · No account required · Crawls up to 200 pages
              </p>
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  {showAdvanced ? 'Hide options' : 'Advanced options'}
                </button>
              </div>
              {showAdvanced && (
                <div className="mt-4 bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {([
                      ['maxPages', 'Max Pages', 1, 200],
                      ['maxDepth', 'Max Depth', 1, 10],
                    ] as const).map(([key, label, min, max]) => (
                      <label key={key} className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-slate-500">{label}</span>
                        <input
                          type="number" min={min} max={max}
                          value={(config[key] as number) ?? (key === 'maxPages' ? 20 : 3)}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              [key]: parseInt(e.target.value) || (key === 'maxPages' ? 20 : 3),
                            }))
                          }
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[#1E1B4B] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    {(
                      ['includePerformance', 'includeAccessibility', 'includeSeo', 'includeSecurity', 'respectRobotsTxt'] as const
                    ).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 cursor-pointer select-none"
                        onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${config[key] ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                          {config[key] && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-slate-600">
                          {key.replace('include', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────── */}
        <section className="w-full bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <dl className="max-w-3xl mx-auto grid grid-cols-3 divide-x divide-slate-100">
              {STATS.map(({ num, label }) => (
                <div key={label} className="text-center px-6 sm:px-10">
                  <dt className="text-3xl sm:text-4xl font-bold text-[#1E1B4B] tabular-nums">{num}</dt>
                  <dd className="text-[11px] text-slate-500 mt-2 font-semibold uppercase tracking-widest">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── FEATURE CARDS ────────────────────────────────────── */}
        <section className="w-full bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">What gets audited</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1E1B4B]">Four categories. Full picture.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map(({ label, desc, icon, color }) => (
                <div key={label} className="rounded-2xl border border-slate-100 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${color}`}>
                    {icon}
                  </div>
                  <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">{label}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SHOWCASE 1 — PERFORMANCE ─────────────────────────── */}
        <section className="w-full bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <ShowcaseText
                label="Performance"
                labelColor="text-amber-600"
                heading={`Measure page speed\nacross your entire site`}
                body="SiteProbe runs a real Chromium browser on every page, capturing Core Web Vitals as users actually experience them — not just your homepage."
                bullets={[
                  'LCP, FCP, CLS, TBT, and TTFB on every crawled page',
                  'Identify your slowest pages at a glance',
                  'Spot render-blocking resources, large payloads, and layout shift',
                ]}
              />
              <div className="lg:pl-8">
                <PerformancePreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── SHOWCASE 2 — ACCESSIBILITY + SEO ─────────────────── */}
        <section className="w-full bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Preview first on desktop (left), second on mobile */}
              <div className="order-2 lg:order-1 lg:pr-8">
                <IssuePreview />
              </div>
              {/* Text second on desktop (right), first on mobile */}
              <div className="order-1 lg:order-2">
                <ShowcaseText
                  label="Accessibility & SEO"
                  labelColor="text-violet-600"
                  heading={`Find what's hurting\nyour reach and rankings`}
                  body="Every page is tested for WCAG 2.1 AA compliance using axe-core and checked for common SEO signals that affect how search engines discover and rank your content."
                  bullets={[
                    'Automated axe-core checks on every crawled page',
                    'Missing alt text, poor contrast, unlabelled form controls',
                    'Meta tags, Open Graph, heading hierarchy, and canonical URLs',
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── SHOWCASE 3 — SECURITY ────────────────────────────── */}
        <section className="w-full bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <ShowcaseText
                label="Security"
                labelColor="text-emerald-600"
                heading={`Catch missing security\nheaders before attackers do`}
                body="SiteProbe checks every page's HTTP response headers against a checklist of industry-standard security controls — giving you a clear picture of your site's posture."
                bullets={[
                  'HSTS, X-Frame-Options, Content-Security-Policy, and more',
                  'Per-page results so you can spot inconsistencies across your site',
                  'Clear pass/fail/warn results with actionable recommendations',
                ]}
              />
              <div className="lg:pl-8">
                <SecurityPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section className="w-full bg-[#F5F3FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">Simple process</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1E1B4B]">How it works</h2>
            </div>
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 relative">
              <div
                className="hidden sm:block absolute h-px bg-indigo-200/70 top-6 pointer-events-none"
                style={{ left: 'calc(16.67% + 1.5rem)', right: 'calc(16.67% + 1.5rem)' }}
              />
              {STEPS.map(({ n, title, desc }) => (
                <div key={n} className="relative z-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold mx-auto mb-5 shadow-md shadow-indigo-200/80">
                    {n}
                  </div>
                  <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="w-full bg-[#1E1B4B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="max-w-xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Audit your website now</h2>
              <p className="text-indigo-300 text-sm mb-10 leading-relaxed">
                Only audit sites you own or have permission to test. Real browser requests may appear in your server analytics.
              </p>
              <PillForm onAuditCreated={onAuditCreated} config={config} dark />
            </div>
          </div>
        </section>

      </main>

      {/* ── PAST AUDITS ──────────────────────────────────────── */}
      {pastAudits.length > 0 && (
        <section className="w-full border-t border-slate-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-6">Recent Audits</h2>
            <ul className="divide-y divide-slate-100" role="list">
              {pastAudits.slice(0, 8).map((audit) => (
                <li key={audit.id}>
                  <div
                    className="flex items-center gap-3 sm:gap-4 py-3.5 cursor-pointer group hover:bg-slate-50 -mx-3 px-3 rounded-xl transition-colors"
                    onClick={() => onSelectAudit(audit.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSelectAudit(audit.id) }}
                    aria-label={`Open audit for ${audit.url}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EBEFF9] flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1E1B4B] truncate">{audit.url}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(audit.createdAt).toLocaleDateString()} · {audit.crawledPages} pages crawled
                      </div>
                    </div>
                    <span className={`${statusCls(audit.status)} shrink-0`}>{audit.status}</span>
                    {audit.scoreOverall != null && (
                      <span className="text-sm font-bold text-[#1E1B4B] tabular-nums w-10 text-right shrink-0">
                        {audit.scoreOverall}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteAudit(audit.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-400 transition-all shrink-0"
                      title="Delete audit"
                      aria-label={`Delete audit for ${audit.url}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <span className="text-xs font-bold text-[#1E1B4B]">SiteProbe</span>
          </div>
          <p className="text-[11px] text-slate-400">Free · Open source · No account required</p>
        </div>
      </footer>

    </div>
  )
}
