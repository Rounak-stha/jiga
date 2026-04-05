import type { PipelineStage, LogEntry } from '../schema'

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'extract', label: 'Extract' },
  { id: 'parse', label: 'AI Parse' },
  { id: 'normalize', label: 'Normalize' },
  { id: 'validate', label: 'Validate' },
  { id: 'repair', label: 'Repair' },
  { id: 'enrich', label: 'Enrich' },
]

const STAGE_ORDER = STAGES.map((s) => s.id)

function stageStatus(stageId: PipelineStage, current: PipelineStage): 'idle' | 'active' | 'done' | 'error' {
  if (current === 'error') {
    const curIdx = STAGE_ORDER.indexOf(stageId)
    const activeIdx = STAGE_ORDER.indexOf('enrich') // last known
    return curIdx <= activeIdx ? 'done' : 'idle'
  }
  if (current === 'done') return 'done'
  const curIdx = STAGE_ORDER.indexOf(current)
  const thisIdx = STAGE_ORDER.indexOf(stageId)
  if (thisIdx < curIdx) return 'done'
  if (thisIdx === curIdx) return 'active'
  return 'idle'
}

interface Props {
  stage: PipelineStage
  log: LogEntry[]
}

export function PipelineProgress({ stage, log }: Props) {
  return (
    <div className="space-y-3">
      {/* Stage bar */}
      <div className="flex border border-border rounded overflow-hidden bg-surface">
        {STAGES.map((s) => {
          const status = stageStatus(s.id, stage)
          return (
            <div
              key={s.id}
              className={`flex-1 py-2.5 px-2 text-center border-r border-border last:border-r-0 transition-all duration-300 ${
                status === 'active'
                  ? 'bg-accent/10 text-accent'
                  : status === 'done'
                  ? 'bg-accent2/5 text-accent2'
                  : status === 'error'
                  ? 'bg-danger/10 text-danger'
                  : 'text-muted'
              }`}
            >
              <span
                className={`block w-1 h-1 rounded-full mx-auto mb-1.5 ${
                  status === 'active' ? 'bg-accent animate-pulse-dot' : 'bg-current opacity-40'
                }`}
              />
              <span className="font-mono text-[9px] uppercase tracking-widest">{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-surface border border-border rounded p-4 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-accent/40 flex-shrink-0 tabular-nums">
                {(entry.ts / 1000).toFixed(2)}s
              </span>
              <span
                className={
                  entry.type === 'done'
                    ? 'text-accent2'
                    : entry.type === 'error'
                    ? 'text-danger'
                    : 'text-muted'
                }
              >
                {entry.msg}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
