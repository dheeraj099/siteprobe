import type { AuditPage, AuditIssue } from '../types'
import SeverityBadge from './SeverityBadge'

interface Props {
  page: AuditPage
  issues: AuditIssue[]
  onBack: () => void
}

function metricBar(val: number | undefined, good: number, bad: number, unit = 'ms') {
  if (val == null) return null
  const pct = Math.min(100, (val / bad) * 100)
  const color = val <= good ? '#22c55e' : val <= (good + bad) / 2 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-[#1c1c26]">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-white w-20 text-right">
        {unit === 'ms' ? `${val}ms` : unit === 'cls' ? val.toFixed(4) : `${val}${unit}`}
      </span>
    </div>
  )
}

export default function PageDetail({ page, issues, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-[#5555aa] hover:text-white transition-colors text-sm">← Back to pages</button>
      </div>

      <div className="p-5 rounded-xl bg-[#111118] border border-[#1c1c26]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-white break-all">{page.title ?? page.url}</h3>
            <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:underline break-all">{page.url}</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {page.status && (
              <span className={`text-sm font-mono font-bold ${page.status < 300 ? 'text-green-400' : page.status < 400 ? 'text-yellow-400' : 'text-red-400'}`}>
                {page.status}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Load Time', value: page.loadTime != null ? `${page.loadTime}ms` : '—' },
            { label: 'Page Weight', value: page.pageWeight != null ? `${(page.pageWeight / 1024).toFixed(0)} KB` : '—' },
            { label: 'DOM Nodes', value: page.domNodes ?? '—' },
            { label: 'Issues', value: page.issuesCount },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-[#1c1c26]">
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-[#5555aa] mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Core Web Vitals */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wide">Core Web Vitals</h4>
          <div className="grid gap-2">
            {[
              { label: 'LCP (Largest Contentful Paint)', val: page.lcp, good: 2500, bad: 4000, unit: 'ms' as const },
              { label: 'FCP (First Contentful Paint)', val: page.fcp, good: 1800, bad: 3000, unit: 'ms' as const },
              { label: 'TTFB (Time to First Byte)', val: page.ttfb, good: 200, bad: 800, unit: 'ms' as const },
              { label: 'TBT (Total Blocking Time)', val: page.tbt, good: 200, bad: 600, unit: 'ms' as const },
              { label: 'CLS (Cumulative Layout Shift)', val: page.cls, good: 0.1, bad: 0.25, unit: 'cls' as const },
            ].map(({ label, val, good, bad, unit }) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div>
                  <div className="text-xs text-[#6666aa] mb-1">{label}</div>
                  {metricBar(val, good, bad, unit)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Page issues */}
      <div>
        <h3 className="font-semibold text-white mb-3">Issues on this page ({issues.length})</h3>
        {issues.length === 0 ? (
          <div className="text-[#3a3a5a] text-sm py-8 text-center">No issues found for this page</div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <div key={issue.id} className="p-4 rounded-lg bg-[#111118] border border-[#1c1c26]">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium mb-1">{issue.title}</div>
                    <p className="text-xs text-[#8888aa]">{issue.description}</p>
                    {issue.recommendation && (
                      <p className="text-xs text-violet-300 mt-2">💡 {issue.recommendation}</p>
                    )}
                  </div>
                  <SeverityBadge severity={issue.severity} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
