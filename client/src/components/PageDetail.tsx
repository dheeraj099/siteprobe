import type { AuditPage, AuditIssue } from '../types'
import SeverityBadge from './SeverityBadge'

interface Props {
  page: AuditPage
  issues: AuditIssue[]
  onBack: () => void
}

interface MetricConfig {
  label: string
  val: number | undefined
  good: number
  bad: number
  unit: 'ms' | 'cls' | 'kb'
  description: string
}

function MetricBar({ label, val, good, bad, unit, description }: MetricConfig) {
  if (val == null) return null
  const pct = Math.min(100, (val / bad) * 100)
  const isGood = val <= good
  const isMid  = val <= (good + bad) / 2
  const color  = isGood ? '#16a34a' : isMid ? '#d97706' : '#dc2626'
  const bgColor = isGood ? 'bg-green-50' : isMid ? 'bg-amber-50' : 'bg-red-50'
  const textColor = isGood ? 'text-green-700' : isMid ? 'text-amber-700' : 'text-red-700'
  const formattedVal = unit === 'ms' ? `${val}ms` : unit === 'cls' ? val.toFixed(4) : `${(val / 1024).toFixed(0)} KB`

  return (
    <div className="flex items-center gap-4">
      <div className="w-40 shrink-0">
        <div className="text-xs font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${bgColor} ${textColor}`}>
        {formattedVal}
      </div>
    </div>
  )
}

export default function PageDetail({ page, issues, onBack }: Props) {
  return (
    <div className="space-y-5 fade-up">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to pages
      </button>

      {/* Page header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 text-base">{page.title ?? 'Untitled Page'}</h2>
            <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all mt-0.5 inline-block">
              {page.url}
            </a>
          </div>
          {page.status && (
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${page.status < 300 ? 'bg-green-50 text-green-700' : page.status < 400 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              {page.status}
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Load Time',   value: page.loadTime   != null ? `${page.loadTime}ms`                       : '—' },
            { label: 'Page Weight', value: page.pageWeight != null ? `${(page.pageWeight/1024).toFixed(0)} KB`  : '—' },
            { label: 'DOM Nodes',   value: page.domNodes   != null ? page.domNodes.toLocaleString()             : '—' },
            { label: 'Issues',      value: page.issuesCount },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-lg font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Core Web Vitals */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Core Web Vitals</h3>
          <div className="space-y-3.5">
            <MetricBar label="LCP" description="Largest Contentful Paint" val={page.lcp}  good={2500} bad={4000} unit="ms" />
            <MetricBar label="FCP" description="First Contentful Paint"   val={page.fcp}  good={1800} bad={3000} unit="ms" />
            <MetricBar label="TTFB" description="Time to First Byte"      val={page.ttfb} good={200}  bad={800}  unit="ms" />
            <MetricBar label="TBT" description="Total Blocking Time"      val={page.tbt}  good={200}  bad={600}  unit="ms" />
            <MetricBar label="CLS" description="Cumulative Layout Shift"  val={page.cls}  good={0.1}  bad={0.25} unit="cls" />
          </div>
        </div>
      </div>

      {/* Issues */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Issues on this page
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-normal">{issues.length}</span>
        </h3>
        {issues.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-sm">No issues found for this page</div>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <div key={issue.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 mb-1">{issue.title}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{issue.description}</p>
                    {issue.recommendation && (
                      <div className="flex gap-1.5 mt-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100">
                        <span className="text-indigo-500 text-xs shrink-0">💡</span>
                        <p className="text-xs text-indigo-700">{issue.recommendation}</p>
                      </div>
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
