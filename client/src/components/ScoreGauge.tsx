interface Props {
  score: number | undefined
  label: string
  size?: number
}

function scoreColor(s: number): { stroke: string; text: string; bg: string } {
  if (s >= 90) return { stroke: '#16a34a', text: '#15803d', bg: '#f0fdf4' }
  if (s >= 70) return { stroke: '#d97706', text: '#b45309', bg: '#fffbeb' }
  if (s >= 50) return { stroke: '#ea580c', text: '#c2410c', bg: '#fff7ed' }
  return { stroke: '#dc2626', text: '#b91c1c', bg: '#fef2f2' }
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Good'
  if (s >= 70) return 'Fair'
  if (s >= 50) return 'Poor'
  return 'Critical'
}

export default function ScoreGauge({ score, label, size = 96 }: Props) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const pct = score != null ? score / 100 : 0
  const dash = circ * pct
  const colors = score != null ? scoreColor(score) : { stroke: '#e2e8f0', text: '#94a3b8', bg: '#f8fafc' }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={10}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold leading-none" style={{ fontSize: size * 0.23, color: colors.text }}>
            {score != null ? score : '—'}
          </span>
          {score != null && (
            <span className="text-xs font-medium mt-0.5" style={{ color: colors.text, fontSize: 9 }}>
              {scoreLabel(score)}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium text-slate-500 tracking-wide">{label}</span>
    </div>
  )
}
