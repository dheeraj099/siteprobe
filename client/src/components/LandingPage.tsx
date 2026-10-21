import { useState } from 'react'
import type { Audit, AuditConfig } from '../types'
import { api } from '../api'

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
  onAuditCreated: (audit: Audit) => void
  pastAudits:     Audit[]
  onSelectAudit:  (id: string) => void
  onDeleteAudit:  (id: string) => void
}

/* ─── Static data ─────────────────────────────────────────────── */
const DEFAULT_CONFIG: Partial<AuditConfig> = {
  maxPages: 20, maxDepth: 3,
  includePerformance: true, includeAccessibility: true,
  includeSeo: true, includeSecurity: true, respectRobotsTxt: true,
}

const CONFIG_TOGGLES: { label: string; key: keyof AuditConfig }[] = [
  { label: 'Performance',   key: 'includePerformance'   },
  { label: 'Accessibility', key: 'includeAccessibility' },
  { label: 'SEO',           key: 'includeSeo'           },
  { label: 'Security',      key: 'includeSecurity'      },
  { label: 'robots.txt',    key: 'respectRobotsTxt'     },
]

const FAQ_ITEMS = [
  { q: 'Which websites can I audit?',
    a: 'Any publicly accessible URL. SiteProbe follows every internal link from your starting URL — no sitemap required.' },
  { q: 'Do I need to create an account?',
    a: 'No. Paste a URL and press Audit. Results stream live as each page is processed — no sign-up, no credit card.' },
  { q: 'What does it check on each page?',
    a: 'Performance (LCP, FCP, CLS, TBT, TTFB), accessibility (WCAG 2.1 AA via axe-core), eight SEO signal types, and six critical security headers.' },
  { q: 'How many pages can one audit cover?',
    a: 'Up to 200 pages per run. The default is 20 pages to a depth of 3. Adjust both under Advanced options before starting.' },
  { q: 'Is it really free?',
    a: 'Yes — completely free, no account needed, and no cap on how many audits you run.' },
]

/* ─── Helpers ─────────────────────────────────────────────────── */
function statusCls(s: Audit['status']): string {
  const map: Record<string, string> = {
    complete: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    failed:   'bg-red-50 text-red-700 ring-1 ring-red-200',
    crawling: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    auditing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    queued:   'bg-stone-100 text-stone-600 ring-1 ring-stone-200',
  }
  return `inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${map[s] ?? map.queued}`
}

const CHECK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2456d6" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

/* ─── Score fragment ──────────────────────────────────────────── */
function ScoreFragment() {
  const SCORES = [
    { label: 'Overall',       score: 82, color: '#16a34a' },
    { label: 'Performance',   score: 87, color: '#16a34a' },
    { label: 'Accessibility', score: 94, color: '#16a34a' },
    { label: 'SEO',           score: 78, color: '#92400e' },
    { label: 'Security',      score: 62, color: '#92400e' },
  ]
  return (
    <div aria-hidden="true" data-ui="" style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {SCORES.map(({ label, score, color }) => {
        const r = 26, c = 2 * Math.PI * r
        const dash = (score / 100) * c, gap = c - dash
        return (
          <div key={label} style={{ textAlign: 'center', minWidth: '58px' }}>
            <svg width="58" height="58" viewBox="0 0 60 60" style={{ display: 'block', margin: '0 auto' }}>
              <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="4" />
              <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={`${dash} ${gap}`} strokeLinecap="round" transform="rotate(-90 30 30)" />
              <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="600" fill="#111827">{score}</text>
            </svg>
            <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', lineHeight: 1.2 }}>{label}</p>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Crawler fragment ────────────────────────────────────────── */
function CrawlerFragment() {
  const PAGES = [
    { url: '/home',      state: 'audited',  issues: 3    },
    { url: '/about',     state: 'audited',  issues: 1    },
    { url: '/pricing',   state: 'crawling', issues: null },
    { url: '/blog',      state: 'queued',   issues: null },
    { url: '/contact',   state: 'queued',   issues: null },
  ]
  return (
    <div aria-hidden="true" data-ui="">
      <div style={{ padding: '9px 14px', background: 'rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>yoursite.com</span>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>5 of 20</span>
      </div>
      {PAGES.map(({ url, state, issues }) => (
        <div key={url} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <span
            className={state === 'crawling' ? 'crawl-pulse' : ''}
            style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: state === 'audited' ? '#16a34a' : state === 'crawling' ? '#2456d6' : 'rgba(0,0,0,0.15)' }}
          />
          <span style={{ flex: 1, fontSize: '12px', color: '#111827' }}>{url}</span>
          {issues !== null
            ? <span style={{ fontSize: '11px', color: issues > 0 ? '#92400e' : '#6b7280' }}>{issues} issue{issues !== 1 ? 's' : ''}</span>
            : state === 'crawling' ? <span style={{ fontSize: '11px', color: '#2456d6' }}>auditing…</span> : null}
        </div>
      ))}
    </div>
  )
}

/* ─── Audit form ──────────────────────────────────────────────── */
interface AuditFormProps {
  onAuditCreated: (audit: Audit) => void
  config:  Partial<AuditConfig>
  variant: 'light' | 'dark'
  inputId: string
}

function AuditForm({ onAuditCreated, config, variant, inputId }: AuditFormProps) {
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let normalized = url.trim()
    if (!normalized) { setError('Enter a URL to audit'); return }
    if (!normalized.startsWith('http')) normalized = 'https://' + normalized
    setLoading(true)
    try {
      const audit = await api.createAudit(normalized, config)
      onAuditCreated(audit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally { setLoading(false) }
  }

  const isDark = variant === 'dark'

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
      <div style={{ display: 'flex' }}>
        <input
          id={inputId}
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="yoursite.com"
          disabled={loading}
          autoComplete="url"
          spellCheck={false}
          aria-label="Website URL"
          style={{
            flex: '1 1 160px',
            padding: '12px 16px',
            fontSize: '15px',
            background: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
            color:      isDark ? '#fff' : '#111827',
            border:     isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.15)',
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            outline: 'none',
            fontFamily: 'var(--font)',
            minWidth: 0,
          }}
          onFocus={e  => { e.target.style.borderColor = '#2456d6' }}
          onBlur={e   => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding:      '12px 24px',
            fontSize:     '15px',
            fontWeight:   600,
            background:   '#2456d6',
            color:        '#fff',
            border:       'none',
            borderRadius: '0 6px 6px 0',
            cursor:       loading ? 'not-allowed' : 'pointer',
            opacity:      loading ? 0.65 : 1,
            whiteSpace:   'nowrap',
            fontFamily:   'var(--font)',
            letterSpacing: '-0.01em',
            flexShrink:   0,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1b42b0' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2456d6' }}
        >
          {loading ? 'Auditing…' : 'Audit free'}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ marginTop: '8px', fontSize: '13px', color: isDark ? '#fca5a5' : '#dc2626' }}>
          {error}
        </p>
      )}
    </form>
  )
}

/* ─── Main page ───────────────────────────────────────────────── */
export default function LandingPage({ onAuditCreated, pastAudits, onSelectAudit, onDeleteAudit }: Props) {
  const [config,       setConfig]       = useState<Partial<AuditConfig>>(DEFAULT_CONFIG)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [openFaq,      setOpenFaq]      = useState<number | null>(null)

  /* shared section padding */
  const sp = 'clamp(60px, 8vw, 100px) var(--margin)'
  /* shared inner max-width wrapper */
  const innerWrap: React.CSSProperties = { maxWidth: '1200px', margin: '0 auto' }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)', minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAV ────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 var(--margin)' }}>
        <div style={{ ...innerWrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.03em' }}>SiteProbe</span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Free — no account needed</span>
        </div>
      </header>

      <main style={{ flex: 1 }}>

        {/* ── HERO ────────────────────────────────────────────── */}
        <section style={{ padding: sp, background: 'var(--bg)' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center' }}>

              {/* Left: text + form */}
              <div className="fade-up">
                <h1 style={{
                  fontSize: 'var(--step-display)', fontWeight: 600, lineHeight: 1.0,
                  letterSpacing: '-0.04em', color: 'var(--ink)', marginBottom: '20px',
                  textWrap: 'balance',
                }}>
                  Audit your entire site in one click.
                </h1>
                <p style={{ fontSize: 'var(--step-lead)', color: 'var(--muted)', lineHeight: 1.45, maxWidth: '44ch', marginBottom: '32px' }}>
                  SiteProbe crawls every page and scores performance, accessibility, SEO, and security. Free, no account needed.
                </p>

                <AuditForm onAuditCreated={onAuditCreated} config={config} variant="light" inputId="url-hero" />

                {/* feature tags */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                  {['Performance', 'Accessibility', 'SEO', 'Security'].map(f => (
                    <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--muted)' }}>
                      {CHECK_ICON} {f}
                    </span>
                  ))}
                </div>

                {/* advanced options */}
                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    style={{ fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font)' }}
                  >
                    {showAdvanced ? '− Advanced options' : '+ Advanced options'}
                  </button>
                  {showAdvanced && (
                    <div style={{ marginTop: '12px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', maxWidth: '460px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        {(['maxPages', 'maxDepth'] as const).map(key => (
                          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{key === 'maxPages' ? 'Max pages' : 'Max depth'}</span>
                            <input
                              type="number" min={1} max={key === 'maxPages' ? 200 : 10}
                              value={(config[key] as number) ?? (key === 'maxPages' ? 20 : 3)}
                              onChange={e => setConfig(c => ({ ...c, [key]: parseInt(e.target.value) || (key === 'maxPages' ? 20 : 3) }))}
                              style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '14px', color: 'var(--ink)', outline: 'none', fontFamily: 'var(--font)' }}
                            />
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                        {CONFIG_TOGGLES.map(({ label, key }) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--ink)', padding: '3px 0' }}>
                            <input type="checkbox" checked={!!config[key]} onChange={() => setConfig(c => ({ ...c, [key]: !c[key] }))} style={{ accentColor: 'var(--accent)', width: '13px', height: '13px' }} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: product preview */}
              <div className="shutter hidden lg:flex" style={{ flexDirection: 'column', gap: '12px' }}>
                <div data-ui="" style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)', padding: '20px 22px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Audit scores · yoursite.com</p>
                  <ScoreFragment />
                </div>
                <div data-ui="" style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <CrawlerFragment />
                </div>
              </div>

              {/* Mobile: show compact preview below form */}
              <div className="flex flex-col lg:hidden" style={{ gap: '12px' }}>
                <div data-ui="" style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)', padding: '16px' }}>
                  <ScoreFragment />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── FEATURE 1: Crawl ────────────────────────────────── */}
        <section style={{ padding: sp, background: '#fff' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 'var(--step-head)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--ink)', marginBottom: '18px', textWrap: 'balance' }}>
                  Crawl every page automatically.
                </h2>
                <p className="fade-up" style={{ fontSize: 'var(--step-body)', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '48ch', marginBottom: '28px', animationDelay: '0.05s' }}>
                  Paste one URL — SiteProbe follows every internal link, discovering pages you might have forgotten. No sitemap, no configuration.
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '11px', listStyle: 'none', padding: 0 }}>
                  {[
                    'Follows internal links automatically',
                    'Up to 200 pages per run',
                    'Respects robots.txt rules',
                    'Real Chromium browser — no fake user agents',
                  ].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: 'var(--step-body)', color: '#374151', lineHeight: 1.45 }}>
                      <span style={{ flexShrink: 0, marginTop: '2px' }}>{CHECK_ICON}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div data-ui="" style={{ background: 'var(--bg)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '16px 16px 0', background: '#fff' }}>
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '12px' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                  </div>
                </div>
                <CrawlerFragment />
                <CrawlerFragment />
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURE 2: Scores ───────────────────────────────── */}
        <section style={{ padding: sp, background: 'var(--bg)' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center' }}>

              {/* Left: visual */}
              <div className="order-2 lg:order-1">
                <div data-ui="" style={{ background: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '16px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score summary</p>
                  <ScoreFragment />
                  <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[['LCP', '2.1s'], ['FCP', '0.8s'], ['CLS', '0.02'], ['TBT', '120ms']].map(([k, v]) => (
                      <div key={k} style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--bg)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: text */}
              <div className="order-1 lg:order-2">
                <h2 style={{ fontSize: 'var(--step-head)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--ink)', marginBottom: '18px', textWrap: 'balance' }}>
                  Scores that actually mean something.
                </h2>
                <p className="fade-up" style={{ fontSize: 'var(--step-body)', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '48ch', marginBottom: '28px', animationDelay: '0.05s' }}>
                  Each page gets a score on four dimensions — with the exact metrics that affect real users, not just an aggregate number.
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '11px', listStyle: 'none', padding: 0 }}>
                  {[
                    'Core Web Vitals: LCP, FCP, CLS, TBT, TTFB',
                    'Accessibility: WCAG 2.1 AA via axe-core',
                    'SEO: 8 signal types per page',
                    'Security: 6 critical header checks',
                  ].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: 'var(--step-body)', color: '#374151', lineHeight: 1.45 }}>
                      <span style={{ flexShrink: 0, marginTop: '2px' }}>{CHECK_ICON}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ───────────────────────────────────────────── */}
        <section style={{ padding: 'clamp(50px, 6vw, 80px) var(--margin)', background: '#111827' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 'clamp(32px, 5vw, 60px)' }}>
              {[
                { number: '17',     label: 'checks per page'     },
                { number: '< 60s',  label: 'typical audit time'  },
                { number: '200',    label: 'pages per run'       },
              ].map(({ number, label }) => (
                <div key={label} className="fade-up" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.0, fontVariantNumeric: 'tabular-nums' }}>
                    {number}
                  </div>
                  <div style={{ fontSize: 'var(--step-body)', color: 'rgba(255,255,255,0.45)', marginTop: '10px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ──────────────────────────────────────── */}
        <section style={{ padding: sp, background: 'var(--accent)' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 'var(--step-head)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#fff', marginBottom: '14px', textWrap: 'balance' }}>
                  Start auditing your site for free.
                </h2>
                <p style={{ fontSize: 'var(--step-body)', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: '40ch' }}>
                  No sign-up. No credit card. Results stream live in under a minute.
                </p>
              </div>
              <div>
                <AuditForm onAuditCreated={onAuditCreated} config={config} variant="dark" inputId="url-cta" />
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  {CONFIG_TOGGLES.slice(0, 4).map(({ label, key }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.65)', padding: '3px 0' }}>
                      <input type="checkbox" checked={!!config[key]} onChange={() => setConfig(c => ({ ...c, [key]: !c[key] }))} style={{ accentColor: '#fff', width: '13px', height: '13px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section style={{ padding: sp, background: '#fff' }}>
          <div style={innerWrap}>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'clamp(40px, 6vw, 80px)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--step-head)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--ink)', marginBottom: '16px', textWrap: 'balance' }}>
                  Common questions.
                </h2>
                <p className="fade-up" style={{ fontSize: 'var(--step-body)', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '36ch', animationDelay: '0.05s' }}>
                  Not finding what you need? SiteProbe is open source.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {FAQ_ITEMS.map(({ q, a }, i) => (
                  <div key={i} style={{ background: openFaq === i ? 'var(--bg)' : 'transparent', borderRadius: '6px', overflow: 'hidden', transition: 'background 0.2s' }}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontSize: 'var(--step-body)', fontWeight: 500, color: 'var(--ink)', fontFamily: 'var(--font)',
                        gap: '12px',
                      }}
                    >
                      <span>{q}</span>
                      <span style={{
                        fontSize: '20px', color: 'var(--muted)', flexShrink: 0,
                        display: 'inline-block',
                        transform: openFaq === i ? 'rotate(45deg)' : 'none',
                        transition: 'transform 0.2s',
                        lineHeight: 1,
                      }}>+</span>
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: '0 18px 18px', fontSize: 'var(--step-body)', color: 'var(--muted)', lineHeight: 1.65 }}>
                        {a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PAST AUDITS ─────────────────────────────────────── */}
        {pastAudits.length > 0 && (
          <section style={{ padding: sp, background: 'var(--bg)' }}>
            <div style={innerWrap}>
              <h2 style={{ fontSize: 'var(--step-head)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: '24px' }}>
                Recent audits
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {pastAudits.map(audit => (
                  <div
                    key={audit.id}
                    role="button" tabIndex={0}
                    onClick={() => onSelectAudit(audit.id)}
                    onKeyDown={e => e.key === 'Enter' && onSelectAudit(audit.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', background: '#fff', cursor: 'pointer', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(36,86,214,0.3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--step-body)', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audit.url}</p>
                      <p style={{ fontSize: 'var(--step-small)', color: 'var(--muted)', marginTop: '2px' }}>
                        {audit.startedAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(audit.startedAt)) : ''}
                      </p>
                    </div>
                    <span className={statusCls(audit.status)}>{audit.status}</span>
                    <button
                      type="button"
                      aria-label={`Delete audit for ${audit.url}`}
                      onClick={e => { e.stopPropagation(); onDeleteAudit(audit.id) }}
                      style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', borderRadius: '4px', lineHeight: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer style={{ padding: 'clamp(36px, 5vw, 56px) var(--margin)', background: '#111827' }}>
        <div style={{ ...innerWrap, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>SiteProbe</span>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: '28ch' }}>Free website auditor. No account needed.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Only audit sites you own or have permission to test.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
