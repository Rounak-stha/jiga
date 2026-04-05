import type { RFQ } from '../schema'
import { ConfidenceBar } from './ConfidenceBar'
import { CostBreakdown } from './CostBreakdown'
import { ManufacturabilityScore } from './ManufacturabilityScore'

interface Props {
  rfq: RFQ
}

function formatProcess(p: string): string {
  return p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDeadline(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SPEC_ROWS: { label: string; getValue: (rfq: RFQ) => string }[] = [
  { label: 'Part',         getValue: (r) => r.part.name ?? '—' },
  { label: 'Material',     getValue: (r) => r.part.material ?? '—' },
  { label: 'Process',      getValue: (r) => formatProcess(r.part.process) },
  { label: 'Quantity',     getValue: (r) => r.part.quantity ? `${r.part.quantity} pcs` : '—' },
  { label: 'Deadline',     getValue: (r) => formatDeadline(r.part.deadline) },
  { label: 'Tolerance',    getValue: (r) => formatProcess(r.part.tolerance_class) },
  { label: 'Surface Fin.', getValue: (r) => r.part.surface_finish ?? '—' },
]

export function RFQCard({ rfq }: Props) {
  const { meta } = rfq
  const conf = meta.confidence

  return (
    <div className="animate-fade-up space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-border">
        <h2 className="text-xl font-bold tracking-tight">Structured RFQ Output</h2>
        <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded ${
          meta.repair_attempts > 0
            ? 'bg-accent2/10 text-accent2'
            : 'bg-accent/10 text-accent'
        }`}>
          {meta.repair_attempts > 0
            ? `${meta.issues_resolved} issue(s) auto-repaired`
            : 'No repairs needed'}
        </span>
        <span className="font-mono text-[9px] text-muted ml-auto">
          {(meta.processing_ms / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Top grid: specs + confidence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Part specs */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-border">
            Part Specifications
          </div>
          <div className="divide-y divide-border/50">
            {SPEC_ROWS.map(({ label, getValue }) => (
              <div key={label} className="flex justify-between items-start py-2.5 gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted flex-shrink-0">
                  {label}
                </span>
                <span className="text-sm font-semibold text-right break-words max-w-[60%]">
                  {getValue(rfq)}
                </span>
              </div>
            ))}
          </div>
          {rfq.part.special_requirements.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted block mb-2">
                Special Reqs
              </span>
              <div className="flex flex-wrap gap-1.5">
                {rfq.part.special_requirements.map((r, i) => (
                  <span key={i} className="font-mono text-[10px] bg-surface2 border border-border px-2 py-0.5 rounded text-text">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-border">
            Extraction Confidence
          </div>
          <div className="space-y-3">
            <ConfidenceBar label="Material"   level={conf.material} />
            <ConfidenceBar label="Process"    level={conf.process} />
            <ConfidenceBar label="Quantity"   level={conf.quantity} />
            <ConfidenceBar label="Tolerance"  level={conf.tolerance_class} />
            <ConfidenceBar label="Deadline"   level={conf.deadline} />
            <ConfidenceBar label="Finish"     level={conf.surface_finish} />
          </div>
        </div>
      </div>

      {/* Bottom grid: cost + DFM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <CostBreakdown cost={rfq.cost} part={rfq.part} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <ManufacturabilityScore mfg={rfq.manufacturability} />
        </div>
      </div>

      {/* Meta bar */}
      <div className="bg-surface border border-border rounded-lg px-5 py-3.5 flex flex-wrap gap-6">
        {[
          ['Repair Attempts', meta.repair_attempts],
          ['Issues Resolved', meta.issues_resolved],
          ['Issues Remaining', meta.issues_remaining],
          ['Tolerance Class', formatProcess(rfq.part.tolerance_class)],
          ['Processing', `${meta.processing_ms}ms`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted">{k}</span>
            <span className="font-mono text-sm text-accent2">{v}</span>
          </div>
        ))}
      </div>

      {/* JSON export */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(rfq, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `rfq-${rfq.part.name?.toLowerCase().replace(/\s+/g, '-') ?? 'output'}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-accent border border-border hover:border-accent/50 rounded px-3 py-1.5 transition-colors"
        >
          ↓ Export JSON
        </button>
      </div>
    </div>
  )
}
