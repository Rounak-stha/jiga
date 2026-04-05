/**
 * Stage 2 — AI Parse (loose)
 * Provider-agnostic via Vercel AI SDK. Swap provider with VITE_AI_PROVIDER env var.
 */

import { generateText } from 'ai'
import { model } from './ai.config'
import type { LooseParsed } from '../schema'

const SYSTEM_PROMPT = `You are an expert manufacturing engineer AI specializing in RFQ (Request for Quote) analysis.
Extract ALL manufacturing specifications from the input and return ONLY a valid JSON object.
No preamble, no explanation, no markdown fences. Raw JSON only.`

const buildUserPrompt = (context: string) => `
Analyze the following RFQ input and extract all specifications:

${context}

Return exactly this JSON structure. Use null for missing fields. Make educated guesses where reasonable.

{
  "part": {
    "name": "descriptive part name or null",
    "material": "fully normalized material name (e.g. 'Aluminum 6061-T6', 'Stainless Steel 316L') or null",
    "process": "one of: cnc | sheet_metal | 3d_print | casting | welding | injection_molding | unknown",
    "quantity": number or null,
    "deadline": "ISO 8601 date string or null",
    "tolerance_class": "one of: standard | precision | ultra_precision",
    "surface_finish": "specific finish spec or null",
    "special_requirements": ["array of strings, e.g. certifications, coatings, testing requirements"]
  },
  "raw_notes": "any ambiguous information worth flagging as a string"
}

Normalization rules:
- 'aluminum' / 'al' / '6061' -> 'Aluminum 6061-T6'
- 'SS' / 'stainless' / '316' -> 'Stainless Steel 316L'
- 'titanium' / 'Ti' -> 'Titanium Grade 5'
- 'tight tolerances' / 'pretty tight' -> precision
- 'very tight' / 'mirror finish' -> ultra_precision
- Infer process from part geometry clues if possible
- If deadline is relative, compute from today: ${new Date().toISOString().split('T')[0]}
`

export async function aiParse(context: string): Promise<LooseParsed> {
	const { text } = await generateText({
		model,
		system: SYSTEM_PROMPT,
		prompt: buildUserPrompt(context)
	})

	console.log(text)

	const clean = text
		.trim()
		.replace(/^```json|^```|```$/gm, '')
		.trim()
	return JSON.parse(clean) as LooseParsed
}
