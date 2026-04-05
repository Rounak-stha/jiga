# RFQ Intelligence Engine

> Email + PDF → Clean RFQ → Cost + Manufacturability Insights  
> A demo project built for Jiga.

## Setup

```bash
npm install
cp .env.example .env
# Add your Anthropic API key to .env
npm run dev
```

## Environment

```
VITE_<PROVIDER>_API_KEY=sk-ant-...
```

> ⚠️ The API key is used client-side (browser). This is intentional for a stateless portfolio demo.

## Pipeline Architecture

```
Email + PDF
    │
    ▼
[1] Extract      — PDF text extraction (pdfjs-dist, browser-native)
    │
    ▼
[2] AI Parse     — Claude loose extraction → unvalidated JSON
    │
    ▼
[3] Normalize    — Loose JSON → strict RFQPart schema (no AI)
    │
    ▼
[4] Validate     — Rules engine: material/process compatibility,
    │              tolerance realism, lead time checks (no AI)
    ▼
[5] Repair       — Targeted Claude repair for fixable issues (max 3x)
    │
    ▼
[6] Enrich       — Cost model + DFM score (pure formulas, no AI)
    │
    ▼
Structured RFQ output
```

## Stack

| Layer       | Technology            |
| ----------- | --------------------- |
| Framework   | React 18 + TypeScript |
| Build       | Vite                  |
| Styling     | Tailwind CSS          |
| AI          | AI SDK                |
| PDF Parsing | pdfjs-dist (browser)  |
| Deploy      | Vercel                |

## Project Structure

```
src/
├── schema.ts               # All TypeScript types — built first
├── pipeline/
│   ├── extract.ts          # PDF + email → context string
│   ├── parse.ts            # AI loose parse
│   ├── normalize.ts        # Strict schema mapping
│   ├── validate.ts         # Rules engine (pure logic, no AI)
│   ├── repair.ts           # AI targeted repair loop
│   ├── enrich.ts           # Cost model + DFM score
│   ├── confidence.ts       # Per-field confidence scoring
│   └── orchestrator.ts     # processRFQ() — wires it all together
└── components/
    ├── InputForm.tsx
    ├── PipelineProgress.tsx
    ├── RFQCard.tsx
    ├── CostBreakdown.tsx
    ├── ManufacturabilityScore.tsx
    └── ConfidenceBar.tsx
```
