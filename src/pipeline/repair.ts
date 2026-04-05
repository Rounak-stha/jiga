/**
 * Stage 5 — Repair
 * Provider-agnostic via Vercel AI SDK. Targeted repair for fixable issues only.
 */

import { generateText } from 'ai'
import { model } from './ai.config'
import type { RFQPart, ValidationIssue } from '../schema'

export async function repairPart(
  part: RFQPart,
  issues: ValidationIssue[],
): Promise<RFQPart> {
  const fixable = issues.filter((i) => i.fixable)
  if (fixable.length === 0) return part

  const prompt = `You are an RFQ normalization assistant. Fix ONLY the listed issues in this part spec JSON.
Return ONLY a valid JSON object with the same keys as the input. No markdown. No explanation.

Current part spec:
${JSON.stringify(part, null, 2)}

Issues to fix:
${fixable.map((i, n) => `${n + 1}. ${i.msg}`).join('\n')}

Rules:
- If process is 'unknown', infer it from part name or material (prefer 'cnc' for metal parts with tight tolerances)
- If surface_finish is null, set it to "As-machined"
- Do NOT change any field not directly related to the listed issues
- Return all original fields unchanged unless fixing an issue
`

  const { text } = await generateText({
    model,
    prompt,
    maxTokens: 512,
  })

  const clean = text.trim().replace(/^```json|^```|```$/gm, '').trim()
  const repaired = JSON.parse(clean) as Partial<RFQPart>

  return {
    ...part,
    process: repaired.process ?? part.process,
    surface_finish: repaired.surface_finish ?? part.surface_finish,
    material: repaired.material ?? part.material,
  }
}
