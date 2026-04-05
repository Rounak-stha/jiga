/**
 * Stage 3 — Normalize
 * Maps loose AI output → strict RFQPart schema.
 * No AI. Pure mapping + defaults.
 */

import type { LooseParsed, RFQPart, ProcessType, ToleranceClass } from '../schema'

const VALID_PROCESSES: ProcessType[] = [
  'cnc', 'sheet_metal', '3d_print', 'casting', 'welding', 'injection_molding', 'unknown',
]

const VALID_TOLERANCE: ToleranceClass[] = ['standard', 'precision', 'ultra_precision']

function normalizeProcess(raw: string | undefined): ProcessType {
  if (!raw) return 'unknown'
  const p = raw.toLowerCase().replace(/[\s-]/g, '_') as ProcessType
  return VALID_PROCESSES.includes(p) ? p : 'unknown'
}

function normalizeTolerance(raw: string | undefined): ToleranceClass {
  if (!raw) return 'standard'
  const t = raw.toLowerCase().replace(/[\s-]/g, '_') as ToleranceClass
  return VALID_TOLERANCE.includes(t) ? t : 'standard'
}

function normalizeDeadline(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

export function normalize(loose: LooseParsed): RFQPart {
  const p = loose.part ?? {}

  return {
    name: p.name ?? null,
    material: p.material ?? null,
    process: normalizeProcess(p.process),
    quantity: typeof p.quantity === 'number' && p.quantity > 0 ? Math.round(p.quantity) : null,
    deadline: normalizeDeadline(p.deadline),
    tolerance_class: normalizeTolerance(p.tolerance_class),
    surface_finish: p.surface_finish ?? null,
    special_requirements: Array.isArray(p.special_requirements)
      ? p.special_requirements.filter(Boolean)
      : [],
  }
}
