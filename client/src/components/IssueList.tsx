import { useState } from 'react'
import type { AuditIssue, IssueCategory, Severity } from '../types'
import SeverityBadge from './SeverityBadge'

interface Props {
  issues: AuditIssue[]
  onSelectPage?: (pageId: string) => void
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
const CATEGORIES: IssueCategory[] = ['performance', 'accessibility', 'seo', 'security', 'reliability']
const CATEGORY_ICON: Record<IssueCategory, string> = {
  performance: '⚡',
  accessibility: '♿',
  seo: '🔍',
  security: '🔒',
  reliability: '🔗',
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

  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = issues.filter((i) => i.severity === s).length
    return acc
  }, {} as Record<Severity, number>)

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {SEVERITY_ORDER.map((s) => counts[s] > 0 && (
          <button
            key={s}
            onClick={() => setFilterSeverity(filterSeverity === s ? 'all' : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterSeverity === s ? 'border-violet-500 text-violet-300' : 'border-[#2d2d42] text-[#6666aa] hover:border-[#3d3d5a]'}`}
          >
            {counts[s]} {s}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-1.5 rounded bg-[#111118] border border-[#2d2d42] text-sm text-white placeholder-[#4a4a6a] focus:outline-none focus:border-violet-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as IssueCategory | 'all')}
          className="px-3 py-1.5 rounded bg-[#111118] border border-[#2d2d42] text-sm text-[#aaaacc] focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="text-xs text-[#5555aa]">{filtered.length} issues shown</div>

      {/* Issue rows */}
      <div className="space-y-2">
        {filtered.map((issue) => (
          <div key={issue.id} className="rounded-lg bg-[#111118] border border-[#1c1c26] overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#1c1c26] transition-colors"
              onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
            >
              <span className="text-base mt-0.5">{CATEGORY_ICON[issue.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{issue.title}</div>
                {issue.url && (
                  <div className="text-xs text-[#5555aa] truncate mt-0.5">{issue.url}</div>
                )}
              </div>
              <SeverityBadge severity={issue.severity} />
              <span className="text-[#3a3a5a] text-sm ml-1">{expandedId === issue.id ? '▲' : '▼'}</span>
            </button>

            {expandedId === issue.id && (
              <div className="px-4 pb-4 pt-0 space-y-3 border-t border-[#1c1c26]">
                <p className="text-sm text-[#aaaacc] pt-3">{issue.description}</p>
                {issue.evidence && (
                  <div className="p-2 rounded bg-[#1c1c26] text-xs font-mono text-[#8888aa] whitespace-pre-wrap break-all">
                    {issue.evidence.length > 400 ? issue.evidence.slice(0, 400) + '...' : issue.evidence}
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-violet-400 text-sm shrink-0">💡</span>
                  <p className="text-sm text-[#aaaacc]">{issue.recommendation}</p>
                </div>
                {issue.pageId && onSelectPage && (
                  <button
                    onClick={() => onSelectPage(issue.pageId!)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    View page details →
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#3a3a5a]">
            {issues.length === 0 ? 'No issues found — great job!' : 'No issues match the current filters'}
          </div>
        )}
      </div>
    </div>
  )
}
