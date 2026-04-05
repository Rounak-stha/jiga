import type { RFQManufacturability } from '../schema'

interface Props {
  mfg: RFQManufacturability
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-accent2'
  if (score >= 40) return 'text-warn'
  return 'text-danger'
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-accent2'
  if (score >= 40) return 'bg-warn'
  return 'bg-danger'
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Good — ready to quote'
  if (score >= 40) return 'Caution — review warnings'
  return 'Blocked — resolve issues first'
}

export function ManufacturabilityScore({ mfg }: Props) {
  const color = scoreColor(mfg.score)
  const barColor = scoreBarColor(mfg.score)

  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-border">
        Manufacturability
      </div>

      {/* Score */}
      <div className={`text-5xl font-extrabold tracking-tighter leading-none mb-1 ${color}`}>
        {mfg.score}
      </div>
      <p className={`font-mono text-[10px] uppercase tracking-widest mb-4 ${color}`}>
        {scoreLabel(mfg.score)}
      </p>

      {/* Bar */}
      <div className="h-1 bg-border rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${mfg.score}%` }}
        />
      </div>

      {/* Issues */}
      <ul className="space-y-2">
        {mfg.blockers.map((b, i) => (
          <li key={`b-${i}`} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
            <span className="flex-shrink-0 mt-px">🔴</span>
            <span className="text-danger/90">{b}</span>
          </li>
        ))}
        {mfg.warnings.map((w, i) => (
          <li key={`w-${i}`} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
            <span className="flex-shrink-0 mt-px">⚠️</span>
            <span className="text-muted">{w}</span>
          </li>
        ))}
        {mfg.blockers.length === 0 && mfg.warnings.length === 0 && (
          <li className="flex items-center gap-2 font-mono text-[11px] text-accent2">
            <span>✅</span> No issues found
          </li>
        )}
      </ul>
    </div>
  )
}
