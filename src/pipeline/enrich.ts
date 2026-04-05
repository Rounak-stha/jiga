/**
 * Stage 6 — Enrich
 * Cost model + manufacturability score.
 * Pure deterministic formulas. No AI — LLMs cannot reliably estimate costs.
 */

import type { RFQPart, RFQCost, RFQManufacturability, ValidationIssue } from '../schema'

// ─── Material multipliers ─────────────────────────────────────────────────────

const MATERIAL_MULTIPLIERS: Array<{ match: string[]; mult: number; label: string }> = [
  { match: ['aluminum', 'al ', 'al-', '6061', '7075', '2024'], mult: 1.0, label: 'Aluminum baseline' },
  { match: ['steel 1018', 'mild steel', 'low carbon'], mult: 1.2, label: 'Steel +20%' },
  { match: ['stainless', 'ss ', '316', '304', '17-4'], mult: 2.1, label: 'Stainless +110%' },
  { match: ['titanium', 'ti-6', 'grade 5'], mult: 4.5, label: 'Titanium +350%' },
  { match: ['inconel', 'in718', 'in625'], mult: 8.0, label: 'Inconel +700%' },
  { match: ['pla', 'petg', 'abs', 'nylon'], mult: 0.4, label: 'Polymer -60%' },
  { match: ['brass'], mult: 1.6, label: 'Brass +60%' },
  { match: ['copper', 'cu'], mult: 1.8, label: 'Copper +80%' },
]

function materialMult(material: string | null): { mult: number; label: string } {
  if (!material) return { mult: 1.0, label: 'Unknown material (baseline)' }
  const m = material.toLowerCase()
  for (const entry of MATERIAL_MULTIPLIERS) {
    if (entry.match.some((k) => m.includes(k))) {
      return { mult: entry.mult, label: entry.label }
    }
  }
  return { mult: 1.0, label: 'Unknown material (baseline)' }
}

// ─── Tolerance multipliers ────────────────────────────────────────────────────

const TOLERANCE_MULT: Record<string, { mult: number; label: string }> = {
  standard: { mult: 1.0, label: '' },
  precision: { mult: 1.8, label: 'Precision tolerance +80%' },
  ultra_precision: { mult: 3.5, label: 'Ultra-precision tolerance +250%' },
}

// ─── Process multipliers ──────────────────────────────────────────────────────

const PROCESS_MULT: Record<string, number> = {
  cnc: 1.0,
  sheet_metal: 0.75,
  '3d_print': 0.45,
  casting: 0.55,
  welding: 0.85,
  injection_molding: 0.35,
  unknown: 1.0,
}

// ─── Quantity factor ──────────────────────────────────────────────────────────

function qtyFactor(qty: number): { factor: number; label: string | null } {
  if (qty <= 5) return { factor: 2.0, label: 'Prototype run +100%' }
  if (qty <= 25) return { factor: 1.4, label: 'Small batch +40%' }
  if (qty <= 100) return { factor: 1.0, label: null }
  if (qty <= 500) return { factor: 0.75, label: 'Volume discount -25%' }
  return { factor: 0.55, label: 'High volume discount -45%' }
}

// ─── Main cost function ───────────────────────────────────────────────────────

export function computeCost(part: RFQPart): RFQCost {
  const BASE = 120 // USD per part baseline (aluminum CNC, qty 26–100)
  const qty = part.quantity ?? 1

  const mat = materialMult(part.material)
  const tol = TOLERANCE_MULT[part.tolerance_class] ?? TOLERANCE_MULT.standard
  const proc = PROCESS_MULT[part.process] ?? 1.0
  const qty_f = qtyFactor(qty)

  const unitCost = BASE * mat.mult * tol.mult * proc * qty_f.factor
  const total = unitCost * qty

  const drivers: string[] = []
  if (mat.mult !== 1.0) drivers.push(mat.label)
  if (tol.mult !== 1.0) drivers.push(tol.label)
  if (qty_f.label) drivers.push(qty_f.label)

  return {
    range_low: Math.round(total * 0.85),
    range_high: Math.round(total * 1.25),
    currency: 'USD',
    drivers,
  }
}

// ─── DFM Score ────────────────────────────────────────────────────────────────

export function computeManufacturability(issues: ValidationIssue[]): RFQManufacturability {
  let score = 100
  const warnings: string[] = []
  const blockers: string[] = []

  for (const issue of issues) {
    if (issue.severity === 'error') {
      score -= 25
      blockers.push(issue.msg)
    } else {
      score -= 10
      warnings.push(issue.msg)
    }
  }

  return {
    score: Math.max(0, score),
    warnings,
    blockers,
  }
}
