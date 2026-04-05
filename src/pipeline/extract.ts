/**
 * Stage 1 — Extract
 * PDF file + email string → single context string for the AI.
 * Uses pdfjs-dist (browser-safe, no server needed).
 */

import * as pdfjsLib from 'pdfjs-dist'

// Point the worker at the CDN so Vite doesn't try to bundle it
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n\n--- Page Break ---\n\n')
}

export function buildContext(email: string, pdfText: string | null): string {
  const parts: string[] = []

  if (email.trim()) {
    parts.push(`=== EMAIL THREAD ===\n${email.trim()}`)
  }

  if (pdfText?.trim()) {
    parts.push(`=== ENGINEERING DRAWING (extracted text) ===\n${pdfText.trim()}`)
  }

  return parts.join('\n\n')
}
