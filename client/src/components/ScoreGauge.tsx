interface Props {
  score: number | undefined
  label: string
  size?: number
}

function scoreColor(s: number): string {
  if (s >= 90) return '#22c55e'
  if (s >= 70) return '#f59e0b'
  if (s >= 50) return '#f97316'
  return '#ef4444'
}

export default function ScoreGauge({ score, label, size = 80 }: Props) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const pct = score != null ? score / 100 : 0
  const dash = circ * pct
  const color = score != null ? scoreColor(score) : '#3f3f5a'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c1c26" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="text-center" style={{ marginTop: -size * 0.62, position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div className="font-bold" style={{ fontSize: size * 0.22, color }}>
          {score != null ? score : '—'}
        </div>
      </div>
      <div className="text-xs text-[#8888aa] mt-1">{label}</div>
    </div>
  )
}
