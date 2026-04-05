import type { RFQCost, RFQPart } from '../schema'

interface Props {
  cost: RFQCost
  part: RFQPart
}

export function CostBreakdown({ cost, part }: Props) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-border">
        Cost Estimate
      </div>

      {/* Range */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold tracking-tight text-accent">
          ${cost.range_low.toLocaleString()}
          <span className="text-xl text-muted mx-1">–</span>
          ${cost.range_high.toLocaleString()}
        </span>
      </div>
      <p className="font-mono text-[10px] text-muted mb-5">
        {cost.currency} · qty {part.quantity ?? '?'} · ±20% estimate
      </p>

      {/* Unit cost */}
      {part.quantity && (
        <div className="flex justify-between items-center py-2 border-b border-border/50 mb-3">
          <span className="font-mono text-[10px] text-muted uppercase tracking-wide">Per unit</span>
          <span className="font-mono text-sm text-text">
            ${Math.round(cost.range_low / part.quantity).toLocaleString()}
            {' '}–{' '}
            ${Math.round(cost.range_high / part.quantity).toLocaleString()}
          </span>
        </div>
      )}

      {/* Drivers */}
      {cost.drivers.length > 0 ? (
        <ul className="space-y-1.5">
          {cost.drivers.map((d, i) => (
            <li key={i} className="flex items-center gap-2 font-mono text-[11px] text-muted">
              <span className="text-accent text-xs">→</span>
              {d}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-[11px] text-muted">Standard pricing applied</p>
      )}
    </div>
  )
}
