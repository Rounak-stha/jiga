import type { ConfidenceLevel } from '../schema'

interface Props {
  label: string
  level: ConfidenceLevel
}

const CONFIG: Record<ConfidenceLevel, { pct: number; color: string; bg: string }> = {
  high:   { pct: 100, color: 'text-accent2', bg: 'bg-accent2' },
  medium: { pct: 55,  color: 'text-warn',    bg: 'bg-warn' },
  low:    { pct: 20,  color: 'text-danger',  bg: 'bg-danger' },
}

export function ConfidenceBar({ label, level }: Props) {
  const { pct, color, bg } = CONFIG[level]

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] text-muted uppercase tracking-wide w-24 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bg}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-[9px] uppercase tracking-widest w-10 text-right flex-shrink-0 ${color}`}>
        {level}
      </span>
    </div>
  )
}
