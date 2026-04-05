/**
 * Stage 4 — Validate
 * Pure rules engine. No AI. Fast, testable, reliable.
 * AI should never validate its own output — this stage catches what parse missed.
 */

import type { RFQPart, ValidationIssue } from '../schema'

// Material → process compatibility matrix
const INCOMPATIBLE: Array<{
  matIncludes: string
  procIncludes: string
  msg: string
}> = [
  { matIncludes: 'titanium', procIncludes: 'sheet_metal', msg: 'Titanium + sheet metal: verify process capability with supplier' },
  { matIncludes: 'titanium', procIncludes: '3d_print', msg: 'Titanium FDM 3D printing is uncommon — confirm SLM/EBM intent' },
  { matIncludes: 'inconel', procIncludes: '3d_print', msg: 'Inconel 3D printing requires metal SLS/EBM, not FDM' },
  { matIncludes: 'pla', procIncludes: 'cnc', msg: 'PLA is not typically CNC machined — confirm process' },
]

export function validateRules(part: RFQPart): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const mat = (part.material ?? '').toLowerCase()
  const proc = part.process.toLowerCase()

  // ── Required fields ──
  if (!part.material) {
    issues.push({ severity: 'error', msg: 'Material not specified — cannot quote without material', fixable: false })
  }

  if (part.process === 'unknown') {
    issues.push({ severity: 'warning', msg: 'Manufacturing process not determined — inferred from context if possible', fixable: true })
  }

  if (!part.quantity) {
    issues.push({ severity: 'warning', msg: 'Quantity not specified — cost estimate will be approximate', fixable: false })
  }

  // ── Surface finish ──
  if (!part.surface_finish) {
    issues.push({ severity: 'warning', msg: 'Surface finish not specified — will default to as-machined', fixable: true })
  }

  // ── Tolerance vs process compatibility ──
  if (part.tolerance_class === 'ultra_precision' && proc === 'sheet_metal') {
    issues.push({ severity: 'error', msg: 'Ultra-precision tolerance (±0.005mm) is not achievable with sheet metal', fixable: false })
  }

  if (part.tolerance_class === 'ultra_precision' && proc === '3d_print') {
    issues.push({ severity: 'error', msg: 'Ultra-precision tolerance not achievable with 3D printing — consider CNC', fixable: false })
  }

  // ── Material + process compatibility ──
  for (const rule of INCOMPATIBLE) {
    if (mat.includes(rule.matIncludes) && proc.includes(rule.procIncludes)) {
      issues.push({ severity: 'warning', msg: rule.msg, fixable: false })
    }
  }

  // ── Lead time realism ──
  if (part.quantity && part.deadline) {
    const daysUntil = Math.round(
      (new Date(part.deadline).getTime() - Date.now()) / 86_400_000,
    )
    if (part.quantity > 500 && daysUntil < 7) {
      issues.push({
        severity: 'warning',
        msg: `Qty ${part.quantity} with ${daysUntil}-day lead time is aggressive — confirm with supplier`,
        fixable: false,
      })
    }
    if (daysUntil < 0) {
      issues.push({ severity: 'error', msg: 'Deadline has already passed', fixable: false })
    }
  }

  return issues
}
