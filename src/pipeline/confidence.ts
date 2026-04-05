/**
 * Confidence scoring — per field.
 * Heuristic: if a field has a real value that isn't a fallback default, it's high.
 */

import type { RFQPart, ConfidenceLevel } from '../schema'

type ConfidenceMap = Record<keyof RFQPart, ConfidenceLevel>

export function scoreConfidence(part: RFQPart): ConfidenceMap {
  return {
    name: part.name ? 'high' : 'low',
    material: part.material ? 'high' : 'low',
    process: part.process !== 'unknown' ? 'high' : 'low',
    quantity: part.quantity ? 'high' : 'low',
    deadline: part.deadline ? 'high' : 'low',
    tolerance_class: part.tolerance_class !== 'standard' ? 'medium' : 'high',
    surface_finish: part.surface_finish
      ? part.surface_finish === 'As-machined'
        ? 'medium' // repaired default
        : 'high'
      : 'low',
    special_requirements: part.special_requirements.length > 0 ? 'high' : 'medium',
  }
}
