import type { Severity } from '../types'

const styles: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  high:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  medium:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  low:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  info:     'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const dot: Record<Severity, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-blue-500',
  info:     'bg-slate-400',
}

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[severity]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[severity]}`} />
      {severity}
    </span>
  )
}
