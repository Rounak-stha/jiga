# RFQ Intelligence Engine — How It Works & Why, Plus Honest Limitations

This document explains every decision in the codebase: what each stage does, why it's designed the way it is, and where the dummy project cuts corners that a real system wouldn't.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Stage 1 — Extract](#2-stage-1--extract)
3. [Stage 2 — AI Parse](#3-stage-2--ai-parse)
4. [Stage 3 — Normalize](#4-stage-3--normalize)
5. [Stage 4 — Validate](#5-stage-4--validate)
6. [Stage 5 — Repair](#6-stage-5--repair)
7. [Stage 6 — Enrich: Cost Model](#7-stage-6--enrich-cost-model)
8. [Stage 6 — Enrich: DFM Score](#8-stage-6--enrich-dfm-score)
9. [Confidence Scoring](#9-confidence-scoring)
10. [The AI Provider Layer](#10-the-ai-provider-layer)
11. [Honest Limitations of This Dummy Project](#11-honest-limitations-of-this-dummy-project)

---

## 1. The Big Picture

The pipeline exists because the gap between raw RFQ input (messy email + PDF) and structured, actionable data is almost entirely an **extraction and normalization problem**, not an expertise problem. The data is all there — it just needs to be pulled out, cleaned, and reasoned about.

The core architectural principle is: **use AI only where ambiguity requires it. Use deterministic logic everywhere else.**

This matters for three reasons:

- **Reliability** — deterministic code is testable, predictable, and fast. AI calls are expensive, slow, and occasionally wrong.
- **Auditability** — when a cost estimate or a DFM warning is wrong, you need to know why. A formula gives you a clear reason. An LLM doesn't.
- **Separation of concerns** — extraction is a different problem from reasoning. Mixing them produces systems that are hard to debug and hard to improve.

The pipeline breaks work into six discrete stages, each with a single job. The orchestrator just runs them in order and handles the repair loop.

---

## 2. Stage 1 — Extract

**File:** `src/pipeline/extract.ts`

**What it does:** Reads the raw PDF file using `pdfjs-dist` (a browser-native PDF library) and concatenates all page text into a single string. Combines that with the email text into one `context` blob that gets passed to the AI.

**Why this way:**

- `pdfjs-dist` runs entirely in the browser. No server, no file upload to an external service, no API key needed for this step. It's the right choice for a frontend-only app.
- Combining email + PDF into one string before sending to the AI means the AI gets full context in a single call, rather than needing to reconcile two separate calls. Simpler, cheaper, more coherent.
- Each PDF page is separated by a `--- Page Break ---` marker so the AI can understand document structure if it matters.

**Limitation in this dummy project:**

`pdfjs-dist` extracts text that is already embedded in the PDF as text characters. If the PDF is a **scanned drawing** (i.e. a photo or a scan of a paper drawing), there is no embedded text — the content is pixels. This extractor will return an empty string and the pipeline will fail silently. A real system would detect this and fall back to a vision model (e.g. Gemini Vision or GPT-4V) to read the drawing as an image.

Also: GD&T symbols (⏥, ⌀, ○, etc.) are special Unicode characters. Many PDF exporters don't embed them correctly — they'll show up as boxes or garbage characters in the extracted text. The AI handles this imperfectly.

---

## 3. Stage 2 — AI Parse

**File:** `src/pipeline/parse.ts`

**What it does:** Sends the full context string to the AI with a detailed prompt. The AI is asked to return a loose JSON object with all the fields it can find. It's explicitly allowed to guess, and it's told that null values for missing fields are fine.

**Why "loose" parsing:**

This is an intentional design choice. If you ask the AI to return a fully validated, strictly typed JSON object in one shot, it will hallucinate values for fields it can't find rather than returning null. By asking for a loose output first — guesses welcome, nulls OK — you get a more honest response. The downstream normalize and validate stages then handle strictness.

**Why a detailed prompt with normalization rules:**

The AI receives explicit rules like `'aluminum' / 'al' → 'Aluminum 6061-T6'` because LLMs are inconsistent about material naming. Without guidance, one input might return `"6061 aluminum"`, another `"Al 6061"`, another `"aluminium alloy"`. The rules steer toward consistent output, which makes the downstream matching logic in enrich.ts more reliable.

**Why today's date is injected into the prompt:**

Relative deadlines like "end of month" or "two weeks from now" are common in RFQ emails. The AI needs a reference point to convert these to ISO dates. Without it, the AI either hallucinates a date or returns null.

**Limitation in this dummy project:**

The AI is asked to return raw JSON. If the model returns even one extra sentence, or wraps the JSON in markdown fences, the `JSON.parse()` call fails and the whole pipeline crashes. The code strips ` ```json ``` ` fences, but it doesn't handle every possible formatting deviation. A production system would use **structured outputs** (JSON mode / tool use / schema-enforced generation) so the model is constrained at the API level to always return valid JSON. The Vercel AI SDK supports this via `generateObject` with a Zod schema — this dummy uses `generateText` for simplicity.

---

## 4. Stage 3 — Normalize

**File:** `src/pipeline/normalize.ts`

**What it does:** Maps the loose AI output to the strict `RFQPart` TypeScript schema. Enforces that `process` is one of the known enum values, that `tolerance_class` is one of three valid strings, that `quantity` is a positive integer, and that `deadline` is a valid ISO date.

**Why a separate stage for this:**

The AI can return anything. Even with a good prompt, it might return `"process": "CNC Machining"` instead of `"cnc"`, or `"tolerance": "precise"` instead of `"precision"`. Normalize is the firewall between "whatever the AI returned" and "what the rest of the system expects." Without it, you'd be doing defensive checks in every downstream stage.

**Why defaults to `'unknown'` and `'standard'` rather than null:**

For `process`, unknown is a valid typed state that the validate and repair stages can act on. For `tolerance_class`, standard is a safe assumption — most parts don't need precision tolerances, so defaulting there avoids over-costing.

**Limitation in this dummy project:**

Material normalization is left entirely to the AI in the parse stage. Normalize doesn't re-normalize material names. So if the AI returns `"aluminium alloy 6061"` instead of `"Aluminum 6061-T6"`, it passes through as-is. The enrich stage then does substring matching on the material string, which is fragile. A real system would have a material lookup table or a controlled vocabulary that normalize enforces.

---

## 5. Stage 4 — Validate

**File:** `src/pipeline/validate.ts`

**What it does:** Runs a set of pure logical rules against the normalized part spec. Checks required fields, material/process compatibility, tolerance/process compatibility, and lead time realism. Returns a list of `ValidationIssue` objects, each tagged with severity (`error` or `warning`) and whether it's auto-fixable.

**Why no AI in validation:**

This is the most important architectural decision in the whole system. The AI produced the data. If you use the AI to validate its own output, it will tend to agree with itself. Bugs and hallucinations will pass through undetected. Rules-based validation is impartial — it doesn't care what the AI said, it just checks whether the result satisfies known constraints.

**Why `fixable: true/false`:**

Not every issue can be repaired automatically. "Material not specified" is not fixable — you can't invent a material. "Process unknown" is fixable — the AI can usually infer a process from the part name and material if it gets a second chance with specific guidance. Tagging fixability means the repair stage only fires the expensive AI call when it has a reasonable chance of succeeding.

**What the rules actually check:**

- **Material required** — you literally cannot quote without knowing what the part is made of.
- **Process unknown** — manufacturing process affects cost, capability, and lead time. If it's unknown, the cost estimate is meaningless.
- **Quantity missing** — quantity drives the entire cost model via the quantity factor.
- **Surface finish missing** — not always a blocker, but important enough to flag. Defaulting to as-machined is a reasonable fallback.
- **Tolerance vs process** — ultra-precision tolerances (±0.005mm) are physically impossible with sheet metal forming or FDM 3D printing. These processes cannot hold that kind of accuracy. Flagging this early prevents bad quotes from going to suppliers.
- **Material/process compatibility** — titanium sheet metal is technically possible but unusual and expensive; PLA is almost never CNC machined. These aren't hard errors, just flags worth surfacing.
- **Lead time realism** — 500+ parts in under 7 days is almost always unrealistic for custom machined parts. Better to flag it early than have the supplier reject the RFQ.

**Limitation in this dummy project:**

The validation rule set is minimal. A real system would have dozens or hundreds of rules covering wall thickness minimums per process, thread depth limits, undercut detection, surface finish achievability per process, coating compatibility with material, certification requirements per industry, and much more. The rules here are illustrative, not comprehensive.

Also: the tolerance/process rules only fire for `ultra_precision`. A real system would also catch `precision` tolerance with injection molding, or standard tolerance with a process that can't even hold that.

---

## 6. Stage 5 — Repair

**File:** `src/pipeline/repair.ts`

**What it does:** Takes the current part spec and the list of fixable issues, sends them both to the AI with a targeted prompt asking it to fix only the listed issues. Merges only the changed fields back — it does not let the AI overwrite fields that were already correct.

**Why targeted repair rather than re-running the full parse:**

Re-running the full parse would discard everything the normalize stage already cleaned up. It would also potentially introduce new errors. By being surgical — "fix these two specific fields, leave everything else alone" — you get a more reliable outcome. The AI has less room to wander.

**Why max 3 attempts:**

The repair loop is guarded by `MAX_REPAIR_ATTEMPTS = 3`. If an issue isn't fixable after 3 tries, it's probably not fixable by the AI at all — it's a genuinely missing piece of information that needs human input. The guard prevents infinite loops and runaway API costs.

**Why only merge specific fields back:**

```ts
return {
	...part,
	process: repaired.process ?? part.process,
	surface_finish: repaired.surface_finish ?? part.surface_finish,
	material: repaired.material ?? part.material
}
```

This is defensive. If the AI returns a repaired object where it also decided to change `quantity` from `50` to `null` for some reason, that change gets silently discarded. Only the fields relevant to fixable issues are allowed to update.

**Limitation in this dummy project:**

The repair stage only handles three fields: `process`, `surface_finish`, and `material`. In a real system, the merge would be smarter — dynamically selecting which fields to allow based on which issues were being fixed.

---

## 7. Stage 6 — Enrich: Cost Model

**File:** `src/pipeline/enrich.ts` → `computeCost()`

**What it does:** Applies a multiplicative formula to estimate total cost:

```
unit_cost = BASE × material_mult × tolerance_mult × process_mult × qty_factor
total = unit_cost × quantity
range_low = total × 0.85
range_high = total × 1.25
```

**Why no AI for cost:**

LLMs cannot reliably estimate manufacturing costs. They have no access to live market data, they don't know your suppliers' capacity, and they tend to produce confident-sounding numbers that are often wrong by orders of magnitude. A formula with documented assumptions is more honest — it says "this is our model" rather than "this is the answer."

---

### The BASE price of $120

`BASE = 120` represents the estimated cost per unit for **a simple aluminum 6061 CNC machined part, in a batch of 26–100 units** — chosen as the mid-range "typical" scenario.

**Where does $120 come from?**

It doesn't come from anywhere rigorous. It's a round number that sits in the plausible range for a simple CNC part (think: a bracket, a spacer, a small plate) based on rough market awareness. Online quoting platforms like Xometry or Fictiv often quote simple aluminum CNC parts in the $80–$200 range for small batches. $120 is a defensible midpoint for that range.

**This is the biggest honesty problem in the cost model.** In a real system, the base price would come from one of:

- Historical quote data from your own database
- A supplier pricing API
- A parametric model that accounts for part volume, surface area, number of features, and machine time estimates

Without any of those, $120 is a guess. A stated, documented guess — but a guess.

---

### Material Multipliers

| Material                | Multiplier | Reasoning                                                                                                                |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Aluminum 6061           | 1.0×       | Baseline. Cheap raw stock, machines easily, widely available.                                                            |
| Steel 1018              | 1.2×       | Slightly harder to machine than aluminum, slightly more raw stock cost.                                                  |
| Stainless Steel 316L    | 2.1×       | Significantly harder to machine (work hardens), tools wear faster, slower feed rates, higher stock cost.                 |
| Titanium Grade 5        | 4.5×       | Very difficult to machine. High tool wear, slow speeds, expensive stock, requires specialist capability.                 |
| Inconel 718             | 8.0×       | Notoriously hard to machine. Extreme tool wear, specialist shops only, very expensive stock. Used in aerospace/turbines. |
| Polymers (PLA/PETG/ABS) | 0.4×       | 3D printed. Cheap filament, fast process, no tooling cost.                                                               |
| Brass                   | 1.6×       | Machines beautifully but stock is expensive (copper-based).                                                              |
| Copper                  | 1.8×       | Similar to brass — excellent machinability, expensive stock.                                                             |

**The honest limitation:** These ratios are directionally correct based on general industry knowledge, not calibrated to any specific supplier or market. Stainless vs aluminum is genuinely around 2× in practice; titanium vs aluminum is genuinely in the 4–6× range. But the exact numbers are estimates. Also, the list only covers 8 materials. In reality there are hundreds of engineering materials — carbon fiber, PEEK, magnesium alloys, tool steels, ceramics, and more — that this system has no data for and defaults to 1.0×, which is wrong.

---

### Tolerance Multipliers

| Class           | Tolerance | Multiplier | Reasoning                                                                                              |
| --------------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Standard        | ±0.1mm    | 1.0×       | General machining. Normal feeds/speeds, no special inspection.                                         |
| Precision       | ±0.025mm  | 1.8×       | Requires slower feeds, more passes, better tooling, CMM inspection. Roughly doubles machining time.    |
| Ultra-precision | ±0.005mm  | 3.5×       | Requires specialized equipment, temperature-controlled environment, 100% inspection, skilled operator. |

The 1.8× and 3.5× values are rough estimates based on the idea that tighter tolerances require more machine time, more expensive tooling, and more inspection. In practice, the actual multiplier depends heavily on the part geometry — a tight tolerance on a simple flat face is much cheaper than the same tolerance on a complex curved bore.

---

### Process Multipliers

| Process           | Multiplier | Reasoning                                                                                            |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| CNC               | 1.0×       | Baseline. The most common process for custom parts.                                                  |
| Sheet Metal       | 0.75×      | Faster than CNC for flat/bent geometries. Laser cutting + bending is efficient.                      |
| 3D Print          | 0.45×      | No tooling, minimal setup, cheap material (for FDM). Very fast for simple shapes.                    |
| Casting           | 0.55×      | High tooling cost amortized over volume; unit cost drops fast at scale.                              |
| Welding           | 0.85×      | Slightly cheaper than full CNC but requires skilled labor.                                           |
| Injection Molding | 0.35×      | At volume, extremely cheap per unit. High upfront tooling cost not modeled here (a real limitation). |

**The honest limitation:** Injection molding's 0.35× process multiplier is deeply misleading without accounting for tooling cost. A mold can cost $10,000–$100,000 upfront. At 50 units, injection molding is almost always more expensive than CNC. The multiplier only makes sense at thousands of units. This model doesn't distinguish setup/tooling cost from per-unit cost, which is a fundamental simplification.

---

### Quantity Factor

| Quantity | Factor | Reasoning                                                                        |
| -------- | ------ | -------------------------------------------------------------------------------- |
| 1–5      | 2.0×   | Prototype premium. Setup time dominates. Operator attention per part is high.    |
| 6–25     | 1.4×   | Small batch. Setup still significant relative to run time.                       |
| 26–100   | 1.0×   | Baseline range. Setup is amortized. Normal production economics.                 |
| 101–500  | 0.75×  | Volume discount. Fewer changeovers, better material pricing, rhythm established. |
| 500+     | 0.55×  | High volume. Dedicated fixtures, bulk material, optimized tooling.               |

These breakpoints and factors are rough but reflect the real shape of manufacturing economics: setup cost is fixed and gets amortized over more parts as quantity grows.

---

### The ±15%/+25% Range

The output is always given as a range, not a point estimate:

```ts
range_low = total × 0.85
range_high = total × 1.25
```

This is intentional. The model has no idea about:

- The actual part geometry complexity
- The supplier's location and labor rate
- Current material market prices
- Whether the part has undercuts, thin walls, or other difficult features
- Whether any post-processing (heat treatment, plating) is needed

The asymmetric range (−15% to +25%) reflects that quotes more often come in higher than estimated than lower — suppliers price in uncertainty and risk.

---

## 8. Stage 6 — Enrich: DFM Score

**File:** `src/pipeline/enrich.ts` → `computeManufacturability()`

**What it does:** Starts at 100 and subtracts points for each validation issue. Errors cost 25 points, warnings cost 10 points. Score floor is 0.

**Why this scoring:**

The numbers are arbitrary but intentional. An error (like "ultra-precision tolerance impossible with sheet metal") represents a fundamental incompatibility that would prevent quoting. It should tank the score significantly. A warning represents something worth flagging but not necessarily a blocker. The 25/10 split keeps the score meaningful across a range of scenarios.

**Limitation in this dummy project:**

The score is only as good as the validation rules. With only ~8 rules, the score is a rough signal, not a rigorous assessment. A real DFM system would analyze the actual geometry — wall thickness, feature accessibility, draft angles for casting, minimum bend radii for sheet metal, and so on. That requires either a CAD model or a vision model reading the drawing as an image. This system has neither.

---

## 9. Confidence Scoring

**File:** `src/pipeline/confidence.ts`

**What it does:** Assigns `high`, `medium`, or `low` confidence to each field based on simple heuristics about the field's value.

**The logic:**

- If a field has a non-null, non-default value → `high`. The AI found something specific.
- If a field has a default/fallback value (e.g. `surface_finish = 'As-machined'` set by repair, or `tolerance_class = 'standard'`) → `medium`. The value exists but was inferred or defaulted, not extracted.
- If a field is null → `low`. Nothing was found.

**Why this matters for the demo:**

Showing confidence per field is one of the most useful things this system does. A sourcing team doesn't just want the extracted data — they want to know which fields to verify before sending a quote. A `low` confidence on material means "call the engineer before quoting." A `high` confidence on quantity means "trust this number."

**Limitation in this dummy project:**

Confidence is purely structural — it's based on whether a value exists, not on how certain the AI actually was. A real confidence score would come from the model itself (many LLMs can return log probabilities or self-assessed confidence) or from cross-referencing the email against the drawing (if both say "aluminum 6061," that's more reliable than only one source saying it).

---

## 10. The AI Provider Layer

**File:** `src/pipeline/ai.config.ts`

**What it does:** Centralizes all AI provider configuration. The rest of the codebase imports `model` from this file and calls `generateText(model, ...)` — it has no knowledge of which provider is active.

**Why this architecture:**

Provider lock-in is a real risk for any AI-dependent system. Anthropic might raise prices, rate-limit your key, or have an outage. Having a single config file that resolves the provider from an environment variable means swapping providers is a one-line change to `.env`, not a codebase refactor.

**Why the Vercel AI SDK specifically:**

The `ai` package provides a unified `LanguageModelV1` interface that all major providers implement. `generateText(model, prompt)` works identically whether `model` is Claude, GPT-4o, Gemini, or Mistral. The prompts don't change. The parsing doesn't change. Only the config changes.

**Limitation in this dummy project:**

Different models have different strengths for this task. Claude is very good at following structured output instructions. GPT-4o is strong at technical extraction. Gemini Flash is fast and cheap. Swapping providers is easy; getting the same quality from every provider is not.

---

## 11. Honest Limitations of This Dummy Project

### What this is

A proof of concept that demonstrates: architectural thinking, separation of concerns, AI integration patterns, and domain understanding of the RFQ problem.

### What this is not

A production system. Here is a plain list of every significant gap:

---

**Cost model is fabricated**

The $120 base price and all multipliers are estimates based on general market awareness, not calibrated to real supplier data. The output should be read as "directionally correct" not "accurate." In production you'd either integrate with a pricing API, train a model on historical quote data, or connect to your supplier network.

---

**Only 8 materials supported**

The system knows about: aluminum, steel 1018, stainless steel, titanium, Inconel, PLA/PETG/ABS, brass, copper. Anything else falls through to a 1.0× multiplier. Real engineering uses hundreds of materials — carbon fiber composites, PEEK, Delrin, magnesium alloys, tool steels (H13, D2, M2), ceramics, and many more.

---

**No geometry awareness**

The cost and DFM logic know nothing about the shape of the part. Two parts with identical material, process, and tolerance can have wildly different costs based on complexity — a flat plate vs a complex manifold with 20 features. Without reading the actual geometry (which requires either a vision model or a CAD API), cost estimates are part-agnostic.

---

**Text-only PDF parsing**

`pdfjs-dist` extracts embedded text. Scanned drawings return empty strings. GD&T symbols often corrupt. Drawings with geometry encoded as vector paths (not text) are invisible to this extractor. A real system would use a vision model to read the drawing as an image.

---

**Injection molding tooling cost not modeled**

The injection molding process multiplier (0.35×) is only valid at high volumes. Mold tooling costs ($10k–$100k+) are not included anywhere. For low quantities, injection molding is almost always more expensive than CNC, which is the opposite of what the model suggests.

---

**No real DFM analysis**

The DFM score is based on a handful of compatibility rules. Real DFM analysis checks: minimum wall thickness per process, minimum feature size, draft angles (casting, injection molding), bend radius vs material thickness (sheet metal), thread engagement depth, surface finish achievability per process, undercut detection, and much more.

---

**Confidence scoring is structural, not probabilistic**

Confidence is based on whether a field has a value, not on how certain the extraction actually was. Two extractions with the same structural result can have very different actual reliability.

---

**No persistent storage**

Every RFQ is processed and forgotten. No history, no audit trail, no ability to compare quotes over time, no training data generated for model improvement. The doc explicitly calls this out as a design decision for the demo, but it's a significant gap for any real use case.

---

**API key is client-side**

The API key is exposed in the browser. Anyone who opens DevTools can see it. This is acceptable for a controlled portfolio demo but is a security non-starter for a real product. A real system would have a backend that holds the key and proxies AI calls.

---

**English only**

The prompts, normalization rules, and validation messages are all in English. Engineering drawings from non-English speaking manufacturers (Germany, Japan, China, South Korea — all major manufacturing hubs) will degrade in quality or fail outright.

---

**No supplier matching**

The pipeline stops at structured RFQ + cost estimate. A real Jiga-like system would continue: match the RFQ to capable suppliers based on process, material, certification requirements, and geography; send RFQs; collect quotes; present comparison. This system has no awareness that suppliers exist.

---

**Repair loop is limited to 3 fields**

The merge after repair only updates `process`, `surface_finish`, and `material`. Any other fixable field would need to be explicitly added to the merge logic.

---

**No unit tests shipped**

The doc specifies tests for validate, enrich, and normalize. They are not included in this dummy project. In a real codebase, these pure-logic stages are exactly the kind of code that should have 100% test coverage.

---

_This document is meant to be read alongside the code, not instead of it. The best demonstration of understanding is the architecture itself — the separation of stages, the decision to keep AI out of validation and enrichment, and the provider-agnostic design. The limitations above are honest, and being honest about them is part of the point._
