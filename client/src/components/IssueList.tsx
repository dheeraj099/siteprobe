import { useState } from 'react'
import type { AuditIssue, IssueCategory, Severity } from '../types'
import SeverityBadge from './SeverityBadge'

interface Props {
  issues: AuditIssue[]
  onSelectPage?: (pageId: string) => void
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
const CATEGORIES: IssueCategory[] = ['performance', 'accessibility', 'seo', 'security', 'reliability']
const CAT_ICON: Record<IssueCategory, string> = { performance: '⚡', accessibility: '♿', seo: '🔍', security: '🔒', reliability: '🔗' }
const CAT_COLOR: Record<IssueCategory, string> = {
  performance:   'bg-yellow-50 text-yellow-700',
  accessibility: 'bg-purple-50 text-purple-700',
  seo:           'bg-blue-50 text-blue-700',
  security:      'bg-red-50 text-red-700',
  reliability:   'bg-slate-100 text-slate-600',
}

const SEV_COUNT_COLOR: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 ring-red-200',
  high:     'bg-orange-50 text-orange-700 ring-orange-200',
  medium:   'bg-amber-50 text-amber-700 ring-amber-200',
  low:      'bg-blue-50 text-blue-700 ring-blue-200',
  info:     'bg-slate-100 text-slate-600 ring-slate-200',
}

export default function IssueList({ issues, onSelectPage }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<IssueCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = issues
    .filter((i) => filterSeverity === 'all' || i.severity === filterSeverity)
    .filter((i) => filterCategory === 'all' || i.category === filterCategory)
    .filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))

  const counts = SEVERITY_ORDER.reduce((acc, s) => { acc[s] = issues.filter((i) => i.severity === s).length; return acc }, {} as Record<Severity, number>)

  return (
    <div className="space-y-5">
      {/* Severity chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterSeverity('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition-colors ${filterSeverity === 'all' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'}`}
        >
          All ({issues.length})
        </button>
        {SEVERITY_ORDER.map((s) => counts[s] > 0 && (
          <button
            key={s}
            onClick={() => setFilterSeverity(filterSeverity === s ? 'all' : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition-colors ${filterSeverity === s ? `${SEV_COUNT_COLOR[s]} ring-1` : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'}`}
          >
            {counts[s]} {s}
          </button>
        ))}
      </div>

      {/* Search + category */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-48 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search issues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as IssueCategory | 'all')}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} issue{filtered.length !== 1 ? 's' : ''} shown</p>

      {/* Issue rows */}
      <div className="space-y-2">
        {filtered.map((issue) => (
          <div key={issue.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
            >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm shrink-0 mt-0.5 ${CAT_COLOR[issue.category]}`}>
                {CAT_ICON[issue.category]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{issue.title}</div>
                {issue.url && <div className="text-xs text-slate-400 truncate mt-0.5">{issue.url}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SeverityBadge severity={issue.severity} />
                <svg className={`text-slate-300 transition-transform ${expandedId === issue.id ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </button>

            {expandedId === issue.id && (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
                <p className="text-sm text-slate-600 pt-4 leading-relaxed">{issue.description}</p>
                {issue.evidence && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-500 whitespace-pre-wrap break-all leading-relaxed">
                    {issue.evidence.length > 500 ? issue.evidence.slice(0, 500) + '…' : issue.evidence}
                  </div>
                )}
                <div className="flex gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                  <svg className="shrink-0 mt-0.5 text-indigo-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <p className="text-xs text-indigo-700 leading-relaxed">{issue.recommendation}</p>
                </div>
                {issue.pageId && onSelectPage && (
                  <button onClick={() => onSelectPage(issue.pageId!)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                    View page details
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-3xl mb-3">{issues.length === 0 ? '🎉' : '🔍'}</div>
            <div className="text-sm font-medium">{issues.length === 0 ? 'No issues found — great job!' : 'No issues match the current filters'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
