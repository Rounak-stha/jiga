/**
 * Orchestrator — processRFQ()
 * Sequences all pipeline stages. Owns error handling and repair loop.
 * Each stage is independently testable. This file only wires them together.
 */

import { buildContext, extractPdfText } from './extract'
import { aiParse } from './parse'
import { normalize } from './normalize'
import { validateRules } from './validate'
import { repairPart } from './repair'
import { computeCost, computeManufacturability } from './enrich'
import { scoreConfidence } from './confidence'
import type { RFQ, PipelineStage, LogEntry } from '../schema'

export interface ProcessRFQInput {
	email: string
	pdfFile: File | null
}

export interface ProcessRFQResult {
	rfq: RFQ
	log: LogEntry[]
}

type OnStage = (stage: PipelineStage) => void
type OnLog = (entry: LogEntry) => void

export async function processRFQ(input: ProcessRFQInput, onStage: OnStage, onLog: OnLog): Promise<ProcessRFQResult> {
	const startMs = Date.now()
	const log: LogEntry[] = []
	const MAX_REPAIR_ATTEMPTS = 3

	function addLog(msg: string, type: LogEntry['type'] = 'info') {
		const entry: LogEntry = { ts: Date.now() - startMs, msg, type }
		log.push(entry)
		onLog(entry)
	}

	// ── Stage 1: Extract ──────────────────────────────────────────────────────
	onStage('extract')
	addLog('Extracting text from inputs…')

	let pdfText: string | null = null
	if (input.pdfFile) {
		addLog(`Parsing PDF: ${input.pdfFile.name}`)
		pdfText = await extractPdfText(input.pdfFile)
		addLog(`PDF extracted — ${pdfText.length} characters`, 'done')
	}

	const context = buildContext(input.email, pdfText)
	if (!context.trim()) throw new Error('No input provided — add an email or PDF.')
	addLog('Context ready', 'done')

	// ── Stage 2: AI Parse ─────────────────────────────────────────────────────
	onStage('parse')
	addLog('Running AI loose parse…')
	const looseParsed = await aiParse(context)
	addLog('AI parse complete', 'done')

	// ── Stage 3: Normalize ────────────────────────────────────────────────────
	onStage('normalize')
	addLog('Normalizing to strict schema…')
	let part = normalize(looseParsed)
	addLog('Normalization complete', 'done')

	// ── Stage 4: Validate ─────────────────────────────────────────────────────
	onStage('validate')
	addLog('Running rules engine…')
	let issues = validateRules(part)
	addLog(
		issues.length === 0 ? 'Validation passed — no issues' : `Validation: ${issues.length} issue(s) found`,
		issues.length === 0 ? 'done' : 'info'
	)

	// ── Stage 5: Repair loop ──────────────────────────────────────────────────
	onStage('repair')
	let repairAttempts = 0
	const issuesBeforeRepair = issues.length

	while (issues.some((i) => i.fixable) && repairAttempts < MAX_REPAIR_ATTEMPTS) {
		repairAttempts++
		addLog(`Repair attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS}…`)
		part = await repairPart(part, issues)
		issues = validateRules(part)
		addLog(
			`After repair: ${issues.length} issue(s) remaining`,
			issues.length < issuesBeforeRepair ? 'done' : 'info'
		)

		await new Promise((r) => setTimeout(r, 30 * 1000)) // brief pause to avoid rate limits and improve log readability
	}

	if (repairAttempts === 0) {
		addLog('No fixable issues — repair skipped', 'done')
	}

	const issuesResolved = issuesBeforeRepair - issues.length

	// ── Stage 6: Enrich ───────────────────────────────────────────────────────
	onStage('enrich')
	addLog('Computing cost model…')
	const cost = computeCost(part)
	addLog('Computing manufacturability score…')
	const manufacturability = computeManufacturability(issues)
	addLog('Scoring per-field confidence…')
	const confidence = scoreConfidence(part)
	addLog('Enrichment complete', 'done')

	onStage('done')
	addLog(`Pipeline complete in ${Date.now() - startMs}ms ✓`, 'done')

	const rfq: RFQ = {
		part,
		cost,
		manufacturability,
		meta: {
			confidence,
			repair_attempts: repairAttempts,
			issues_resolved: issuesResolved,
			issues_remaining: issues.length,
			processing_ms: Date.now() - startMs
		}
	}

	return { rfq, log }
}
