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

function statusDot(state: AuditPage['auditState']) {
  if (state === 'audited') return 'bg-green-500'
  if (state === 'failed') return 'bg-red-500'
  if (state === 'crawling') return 'bg-yellow-500'
  return 'bg-zinc-600'
}

export default function Dashboard({ audit, onBack, onExport }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [pageSearch, setPageSearch] = useState('')

  const selectedPage = selectedPageId ? audit.pages.find((p) => p.id === selectedPageId) : null
  const pageIssues = selectedPage ? audit.issues.filter((i) => i.pageId === selectedPage.id) : []

  const filteredPages = audit.pages.filter((p) =>
    !pageSearch || p.url.toLowerCase().includes(pageSearch.toLowerCase()) || (p.title?.toLowerCase().includes(pageSearch.toLowerCase()))
  )

  const duration = audit.completedAt && audit.startedAt
    ? Math.round((audit.completedAt - audit.startedAt) / 1000)
    : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#1c1c26] px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-[#5555aa] hover:text-white transition-colors text-sm">← New Audit</button>
        <div className="w-px h-4 bg-[#1c1c26]" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-white font-medium truncate">{audit.url}</span>
          {duration != null && <span className="text-xs text-[#5555aa] ml-2">Completed in {duration}s</span>}
        </div>
        <button
          onClick={onExport}
          className="px-4 py-2 rounded-lg bg-[#1c1c26] hover:bg-[#2d2d42] border border-[#2d2d42] text-sm text-white transition-colors"
        >
          Export JSON
        </button>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-6">
        {/* Score gauges */}
        <div className="p-6 rounded-xl bg-[#111118] border border-[#1c1c26]">
          <div className="flex flex-wrap justify-around gap-6">
            <ScoreGauge score={audit.scoreOverall} label="Overall" size={100} />
            <ScoreGauge score={audit.scorePerformance} label="Performance" size={100} />
            <ScoreGauge score={audit.scoreAccessibility} label="Accessibility" size={100} />
            <ScoreGauge score={audit.scoreSeo} label="SEO" size={100} />
            <ScoreGauge score={audit.scoreSecurity} label="Security" size={100} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pages Crawled', value: audit.crawledPages },
            { label: 'Pages Audited', value: audit.auditedPages },
            { label: 'Total Issues', value: audit.issues.length },
            { label: 'Critical Issues', value: audit.issueCounts?.critical ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-lg bg-[#111118] border border-[#1c1c26] text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-[#5555aa] mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-[#1c1c26]">
          {(['overview', 'pages', 'issues'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'text-white border-violet-500' : 'text-[#6666aa] border-transparent hover:text-[#aaaacc]'}`}
            >
              {t} {t === 'issues' ? `(${audit.issues.length})` : t === 'pages' ? `(${audit.pages.length})` : ''}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Issue distribution */}
            <div className="p-5 rounded-xl bg-[#111118] border border-[#1c1c26]">
              <h3 className="font-semibold text-white mb-4">Issue Distribution</h3>
              <div className="space-y-3">
                {(['critical', 'high', 'medium', 'low', 'info'] as const).map((s) => {
                  const count = audit.issueCounts?.[s] ?? 0
                  const total = audit.issues.length || 1
                  const pct = Math.round((count / total) * 100)
                  const colors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#6b7280' }
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="text-xs text-[#6666aa] w-16 capitalize">{s}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#1c1c26]">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[s] }} />
                      </div>
                      <span className="text-xs font-mono text-white w-8 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top issues preview */}
            <div className="p-5 rounded-xl bg-[#111118] border border-[#1c1c26]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Top Issues</h3>
                <button onClick={() => setTab('issues')} className="text-xs text-violet-400 hover:text-violet-300">View all →</button>
              </div>
              <IssueList
                issues={audit.issues.slice(0, 5)}
                onSelectPage={(pid) => { setSelectedPageId(pid); setTab('pages') }}
              />
            </div>
          </div>
        )}

        {tab === 'pages' && (
          <div className="space-y-4">
            {selectedPage ? (
              <PageDetail
                page={selectedPage}
                issues={pageIssues}
                onBack={() => setSelectedPageId(null)}
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111118] border border-[#2d2d42] text-white placeholder-[#4a4a6a] text-sm focus:outline-none focus:border-violet-500"
                />
                <div className="space-y-2">
                  {filteredPages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPageId(page.id)}
                      className="w-full text-left p-4 rounded-lg bg-[#111118] border border-[#1c1c26] hover:border-[#2d2d42] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusDot(page.auditState)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{page.title ?? page.url}</div>
                          <div className="text-xs text-[#5555aa] truncate mt-0.5">{page.url}</div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#6666aa]">
                            {page.lcp != null && <span>LCP: {page.lcp}ms</span>}
                            {page.cls != null && <span>CLS: {page.cls.toFixed(3)}</span>}
                            {page.loadTime != null && <span>Load: {page.loadTime}ms</span>}
                            <span>Depth: {page.crawlDepth}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {page.status && (
                            <span className={`text-xs font-mono ${page.status < 300 ? 'text-green-400' : 'text-red-400'}`}>{page.status}</span>
                          )}
                          {page.issuesCount > 0 && (
                            <span className="text-xs text-orange-400">{page.issuesCount} issues</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredPages.length === 0 && (
                    <div className="text-center py-12 text-[#3a3a5a]">No pages match search</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'issues' && (
          <IssueList
            issues={audit.issues}
            onSelectPage={(pid) => { setSelectedPageId(pid); setTab('pages') }}
          />
        )}
      </div>
    </div>
  )
}
