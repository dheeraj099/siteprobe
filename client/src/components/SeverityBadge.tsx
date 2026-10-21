import type { Severity } from '../types'

const styles: Record<Severity, string> = {
  critical: 'bg-red-950/60 text-red-400 border border-red-800/50',
  high: 'bg-orange-950/60 text-orange-400 border border-orange-800/50',
  medium: 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/50',
  low: 'bg-blue-950/60 text-blue-400 border border-blue-800/50',
  info: 'bg-zinc-900 text-zinc-400 border border-zinc-700/50',
}

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[severity]}`}>
      {severity}
    </span>
  )
}
