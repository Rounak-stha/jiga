/**
 * AI Provider Configuration
 * ─────────────────────────
 * Swap providers by setting VITE_AI_PROVIDER in your .env:
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import type { LanguageModelV1 } from 'ai'

export type SupportedProvider = 'anthropic' | 'openai' | 'google' | 'mistral'

interface ProviderConfig {
	label: string
	model: string
	getModel: () => LanguageModelV1
}

const PROVIDERS: Record<SupportedProvider, ProviderConfig> = {
	anthropic: {
		label: 'Claude (Anthropic)',
		model: 'claude-opus-4-5',
		getModel: () =>
			createAnthropic({
				apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
				// Required for browser usage
				headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
			})('claude-opus-4-5')
	},
	openai: {
		label: 'GPT-4o (OpenAI)',
		model: 'gpt-4o',
		getModel: () =>
			createOpenAI({
				apiKey: import.meta.env.VITE_OPENAI_API_KEY,
				compatibility: 'strict'
			})('gpt-4o')
	},
	google: {
		label: 'Gemini 2.5 Flash (Google)',
		model: 'gemini-2.5-flash',
		getModel: () =>
			createGoogleGenerativeAI({
				apiKey: import.meta.env.VITE_GOOGLE_API_KEY
			})('gemini-2.5-flash')
	},
	mistral: {
		label: 'Mistral Large (Mistral)',
		model: 'mistral-large-latest',
		getModel: () =>
			createMistral({
				apiKey: import.meta.env.VITE_MISTRAL_API_KEY
			})('mistral-large-latest')
	}
}

function resolveProvider(): SupportedProvider {
	const raw = import.meta.env.VITE_AI_PROVIDER ?? 'anthropic'
	if (raw in PROVIDERS) return raw as SupportedProvider
	console.warn(`Unknown provider "${raw}", falling back to anthropic`)
	return 'anthropic'
}

const activeProvider = resolveProvider()
const config = PROVIDERS[activeProvider]

/** The active language model — used in parse.ts and repair.ts */
export const model: LanguageModelV1 = config.getModel()

/** Human-readable label for the UI */
export const providerLabel = config.label

/** Active provider id */
export const provider = activeProvider
