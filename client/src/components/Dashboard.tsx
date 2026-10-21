import { useState } from 'react'
import type { AuditDetail, AuditPage } from '../types'
import ScoreGauge from './ScoreGauge'
import IssueList from './IssueList'
import PageDetail from './PageDetail'

interface Props {
  audit: AuditDetail
  onBack: () => void
  onExport: () => void
}

type Tab = 'overview' | 'pages' | 'issues'

const SEV_BAR: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-blue-400', info: 'bg-slate-300' }
const SEV_TEXT: Record<string, string> = { critical: 'text-red-600', high: 'text-orange-600', medium: 'text-amber-600', low: 'text-blue-600', info: 'text-slate-500' }

function stateColor(state: AuditPage['auditState']) {
  if (state === 'audited') return 'bg-green-500'
  if (state === 'failed')  return 'bg-red-400'
  if (state === 'crawling') return 'bg-amber-400'
  return 'bg-slate-300'
}

export default function Dashboard({ audit, onBack, onExport }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [pageSearch, setPageSearch] = useState('')

  const selectedPage = selectedPageId ? audit.pages.find((p) => p.id === selectedPageId) : null
  const pageIssues   = selectedPage ? audit.issues.filter((i) => i.pageId === selectedPage.id) : []

  const filteredPages = audit.pages.filter((p) =>
    !pageSearch || p.url.toLowerCase().includes(pageSearch.toLowerCase()) || (p.title?.toLowerCase().includes(pageSearch.toLowerCase()))
  )

  const duration = audit.completedAt && audit.startedAt
    ? Math.round((audit.completedAt - audit.startedAt) / 1000)
    : null

  const totalIssues = audit.issues.length
  const criticalCount = audit.issueCounts?.critical ?? 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            New Audit
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{audit.url}</div>
            {duration && <div className="text-xs text-slate-400 mt-0.5">Completed in {duration}s · {audit.crawledPages} pages</div>}
          </div>
          <button
            onClick={onExport}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Score card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-wrap justify-around gap-8">
            <ScoreGauge score={audit.scoreOverall}       label="Overall"       size={110} />
            <ScoreGauge score={audit.scorePerformance}   label="Performance"   size={110} />
            <ScoreGauge score={audit.scoreAccessibility} label="Accessibility" size={110} />
            <ScoreGauge score={audit.scoreSeo}           label="SEO"           size={110} />
            <ScoreGauge score={audit.scoreSecurity}      label="Security"      size={110} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pages Crawled', value: audit.crawledPages, icon: '🕷️' },
            { label: 'Pages Audited', value: audit.auditedPages, icon: '✅' },
            { label: 'Total Issues',  value: totalIssues,        icon: '⚠️' },
            { label: 'Critical',      value: criticalCount,      icon: '🚨' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base">{icon}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {(['overview', 'pages', 'issues'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                  tab === t ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {t}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  {t === 'issues' ? totalIssues : t === 'pages' ? audit.pages.length : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab panels */}
        {tab === 'overview' && (
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Issue distribution */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Issue Distribution</h3>
              <div className="space-y-3">
                {(['critical','high','medium','low','info'] as const).map((s) => {
                  const count = audit.issueCounts?.[s] ?? 0
                  const pct = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-14 capitalize ${SEV_TEXT[s]}`}>{s}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-2 rounded-full ${SEV_BAR[s]}`} style={{ width: `${pct}%`, transition: 'width 0.7s ease' }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-8 text-right tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top issues */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Top Issues</h3>
                <button onClick={() => setTab('issues')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">View all →</button>
              </div>
              <div className="space-y-3">
                {audit.issues.slice(0, 5).map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{issue.title}</div>
                      {issue.url && <div className="text-xs text-slate-400 truncate mt-0.5">{issue.url}</div>}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_TEXT[issue.severity]} bg-slate-50`}>
                      {issue.severity}
                    </span>
                  </div>
                ))}
                {audit.issues.length === 0 && <div className="text-sm text-slate-400 text-center py-4">🎉 No issues found</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'pages' && (
          <div className="space-y-4">
            {selectedPage ? (
              <PageDetail page={selectedPage} issues={pageIssues} onBack={() => setSelectedPageId(null)} />
            ) : (
              <>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    placeholder="Search pages…"
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  {filteredPages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPageId(page.id)}
                      className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${stateColor(page.auditState)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                            {page.title ?? page.url}
                          </div>
                          <div className="text-xs text-slate-400 truncate mt-0.5">{page.url}</div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                            {page.lcp   != null && <span>LCP: <strong className="text-slate-600">{page.lcp}ms</strong></span>}
                            {page.cls   != null && <span>CLS: <strong className="text-slate-600">{page.cls.toFixed(3)}</strong></span>}
                            {page.loadTime != null && <span>Load: <strong className="text-slate-600">{page.loadTime}ms</strong></span>}
                            <span>Depth: <strong className="text-slate-600">{page.crawlDepth}</strong></span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {page.status && (
                            <span className={`text-xs font-mono font-bold ${page.status < 300 ? 'text-green-600' : 'text-red-500'}`}>{page.status}</span>
                          )}
                          {page.issuesCount > 0 && (
                            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{page.issuesCount} issues</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredPages.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <div className="text-2xl mb-2">🔍</div>
                      <div className="text-sm">No pages match your search</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'issues' && (
          <IssueList issues={audit.issues} onSelectPage={(pid) => { setSelectedPageId(pid); setTab('pages') }} />
        )}
      </div>
    </div>
  )
}
