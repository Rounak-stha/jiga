import { useState, useCallback } from 'react'
import { InputForm } from './components/InputForm'
import { PipelineProgress } from './components/PipelineProgress'
import { RFQCard } from './components/RFQCard'
import { processRFQ } from './pipeline/orchestrator'
import { providerLabel } from './pipeline/ai.config'
import type { RFQ, PipelineStage, LogEntry } from './schema'

export default function App() {
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [log, setLog] = useState<LogEntry[]>([])
  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isProcessing = stage !== 'idle' && stage !== 'done' && stage !== 'error'

  const handleSubmit = useCallback(async (email: string, pdfFile: File | null) => {
    setRfq(null)
    setError(null)
    setLog([])
    setStage('extract')

    try {
      const result = await processRFQ(
        { email, pdfFile },
        (s) => setStage(s),
        (entry) => setLog((prev) => [...prev, entry]),
      )
      setRfq(result.rfq)
    } catch (err) {
      setStage('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text" style={{ backgroundImage: 'linear-gradient(rgba(232,255,74,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(232,255,74,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <div className="max-w-5xl mx-auto px-5 py-10 pb-20">

        {/* Header */}
        <header className="flex items-start justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none">
              RFQ <span className="text-accent">Intelligence</span> Engine
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted mt-2">
              Email + PDF → Clean RFQ → Cost + Manufacturability Insights
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mt-1">
            <div className="bg-surface2 border border-border rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent">
              Portfolio / Jiga
            </div>
            <div className="bg-surface2 border border-border rounded px-3 py-1 font-mono text-[9px] text-muted">
              via {providerLabel}
            </div>
          </div>
        </header>

        {/* Pipeline progress — always visible once started */}
        {stage !== 'idle' && (
          <div className="mb-6">
            <PipelineProgress stage={stage} log={log} />
          </div>
        )}

        {/* Input form */}
        {(stage === 'idle' || stage === 'done' || stage === 'error') && (
          <div className="mb-8">
            <InputForm onSubmit={handleSubmit} disabled={isProcessing} />
          </div>
        )}

        {/* Processing spinner placeholder */}
        {isProcessing && (
          <div className="mb-8 text-center font-mono text-xs text-muted py-4">
            Running pipeline…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 bg-danger/5 border border-danger/30 rounded-lg px-5 py-4 font-mono text-sm text-danger">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {rfq && <RFQCard rfq={rfq} />}

        {/* Reset button after done */}
        {(stage === 'done' || stage === 'error') && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => { setStage('idle'); setRfq(null); setError(null); setLog([]) }}
              className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-text border border-border hover:border-muted rounded px-4 py-2 transition-colors"
            >
              ← Process another RFQ
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
