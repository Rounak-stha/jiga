// ─── Enums ────────────────────────────────────────────────────────────────────

export type ProcessType =
  | 'cnc'
  | 'sheet_metal'
  | '3d_print'
  | 'casting'
  | 'welding'
  | 'injection_molding'
  | 'unknown'

export type ToleranceClass = 'standard' | 'precision' | 'ultra_precision'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type IssueSeverity = 'error' | 'warning'

// ─── Core Part ────────────────────────────────────────────────────────────────

export interface RFQPart {
  name: string | null
  material: string | null
  process: ProcessType
  quantity: number | null
  deadline: string | null // ISO date
  tolerance_class: ToleranceClass
  surface_finish: string | null
  special_requirements: string[]
}

// ─── Cost ─────────────────────────────────────────────────────────────────────

export interface RFQCost {
  range_low: number
  range_high: number
  currency: 'USD'
  drivers: string[]
}

// ─── Manufacturability ────────────────────────────────────────────────────────

export interface RFQManufacturability {
  score: number // 0–100
  warnings: string[]
  blockers: string[]
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface RFQMeta {
  confidence: Record<keyof RFQPart, ConfidenceLevel>
  repair_attempts: number
  issues_resolved: number
  issues_remaining: number
  processing_ms: number
}

// ─── Top-level RFQ ────────────────────────────────────────────────────────────

export interface RFQ {
  part: RFQPart
  cost: RFQCost
  manufacturability: RFQManufacturability
  meta: RFQMeta
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  severity: IssueSeverity
  msg: string
  fixable: boolean
}

export type PipelineStage =
  | 'idle'
  | 'extract'
  | 'parse'
  | 'normalize'
  | 'validate'
  | 'repair'
  | 'enrich'
  | 'done'
  | 'error'

export interface PipelineState {
  stage: PipelineStage
  log: LogEntry[]
}

export interface LogEntry {
  ts: number
  msg: string
  type: 'info' | 'done' | 'error'
}

// ─── Loose parse output from AI ───────────────────────────────────────────────

export interface LooseParsed {
  part: Partial<RFQPart>
  raw_notes?: string
}
