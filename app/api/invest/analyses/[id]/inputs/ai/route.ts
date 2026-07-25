import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { jsonrepair } from 'jsonrepair'
import {
  getInvestDb,
  analyses,
  analysisInputs,
  assets,
  fundamentalsSnapshots,
  priceSnapshots,
} from '@/lib/invest/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

// Every input on the analysis page. The model fills all of them: for the
// fundamentals it reuses the exact fetched value when the API supplied one and
// only estimates the gaps; the judgment inputs it estimates outright.
// `percent` fields are asked for in percentage points (e.g. 8 = 8%) and stored
// as a fraction (0.08); everything else is stored as-is. min/max are sanity
// clamps in the model's units; `unit` documents the expected value for the prompt.
const AI_FIELDS: Record<string, { percent: boolean; min: number; max: number; unit: string }> = {
  // ── Fundamentals (reuse fetched value when present, else estimate) ──
  fcfBase:           { percent: false, min: -1e12, max: 5e12, unit: 'absolute TTM free cash flow in the reporting currency, full integer (no K/M/B)' },
  netDebt:           { percent: false, min: -5e12, max: 5e12, unit: 'total debt minus cash, full integer (negative = net cash)' },
  totalDebt:         { percent: false, min: 0,     max: 5e12, unit: 'gross debt, full integer' },
  ebitda:            { percent: false, min: -1e12, max: 5e12, unit: 'TTM EBITDA, full integer' },
  eps:               { percent: false, min: -200,  max: 2000, unit: 'trailing EPS per share in the reporting currency' },
  sharesOutstanding: { percent: false, min: 1e5,   max: 5e11, unit: 'diluted share count, full integer' },
  beta:              { percent: false, min: 0,     max: 3.5,  unit: 'plain number, typically 0.7–1.6' },
  // ── Growth path + terminal ──
  fcfGrowthY1: { percent: true, min: -40, max: 60, unit: 'percent points' },
  fcfGrowthY2: { percent: true, min: -40, max: 55, unit: 'percent points' },
  fcfGrowthY3: { percent: true, min: -40, max: 50, unit: 'percent points' },
  fcfGrowthY4: { percent: true, min: -40, max: 45, unit: 'percent points' },
  fcfGrowthY5: { percent: true, min: -40, max: 40, unit: 'percent points' },
  terminalGrowth: { percent: true, min: 0, max: 4, unit: 'percent points' },
  // ── WACC components ──
  discountRate: { percent: true, min: 4, max: 20, unit: 'percent points (WACC)' },
  riskFreeRate: { percent: true, min: 0, max: 10, unit: 'percent points' },
  equityRiskPremium: { percent: true, min: 3, max: 8, unit: 'percent points' },
  costOfDebt: { percent: true, min: 0, max: 15, unit: 'percent points' },
  taxRate: { percent: true, min: 0, max: 40, unit: 'percent points' },
  // ── Relative-valuation benchmarks ──
  peBenchmark: { percent: false, min: 3, max: 60, unit: 'P/E multiple' },
  evEbitdaBenchmark: { percent: false, min: 2, max: 40, unit: 'EV/EBITDA multiple' },
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// Fills EVERY input on the analysis page for a ticker and writes them as manual
// overrides, then recomputes. Fundamentals reuse the fetched API value when
// present (so accurate data isn't degraded) and are estimated only when missing;
// the judgment inputs are estimated. The model can't see live filings, so the
// result is a starting point to verify — never advice.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const db = getInvestDb()
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1)
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  const [asset] = await db.select().from(assets).where(eq(assets.id, analysis.assetId)).limit(1)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const inputs = await db.select().from(analysisInputs).where(eq(analysisInputs.analysisId, id))
  const [latestPrice] = await db
    .select({ price: priceSnapshots.price })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.assetId, asset.id))
    .orderBy(desc(priceSnapshots.date))
    .limit(1)
  const [fundamentals] = await db
    .select({ data: fundamentalsSnapshots.data })
    .from(fundamentalsSnapshots)
    .where(eq(fundamentalsSnapshots.assetId, asset.id))
    .orderBy(desc(fundamentalsSnapshots.fetchedAt))
    .limit(1)

  const facts = {
    ticker: asset.ticker,
    name: asset.name,
    sector: asset.sector ?? 'unknown',
    currency: asset.currency,
    currentPrice: latestPrice?.price ?? null,
    fundamentals: fundamentals?.data ?? null,
  }

  const system = [
    'You are a valuation assistant filling in EVERY input of a 5-year FCFF discounted-cash-flow model for a stock, tailored to THIS company and sector.',
    'You are given the company and the hard fundamentals already fetched from a data API (the "fundamentals" object).',
    'For the fundamental fields (fcfBase, netDebt, totalDebt, ebitda, eps, sharesOutstanding, beta): when the fundamentals object supplies the value, RETURN THAT EXACT VALUE — fcfBase=fcf, totalDebt=totalDebt, ebitda=ebitda, eps=eps, sharesOutstanding=sharesOutstanding, beta=beta, netDebt=totalDebt−cash. Estimate a fundamental only when its source value is null/missing.',
    'For the judgment inputs, estimate from what is generally known about the company.',
    'Rules: FCF growth must fade DOWN from year 1 to year 5 toward the terminal rate (no flat high growth). Terminal growth must be at or below long-run GDP (~2–3%) and strictly below the discount rate. The discount rate should be a realistic WACC. Risk-free rate ≈ the current 10-year government-bond yield for the listing currency. Equity risk premium ≈ 4.5–5.5%.',
    'Give every value as a plain JSON number in the unit noted per field — never abbreviate large figures (write 100000000000, not "100B").',
    'You cannot see live filings or prices, so these are estimates to verify — never a buy/sell recommendation.',
    'Return ONLY a JSON object: {"values": {"<key>": <number>}, "rationale": "<one or two sentences>"}.',
  ].join(' ')

  const fieldList = Object.entries(AI_FIELDS)
    .map(([k, c]) => `- ${k} — ${c.unit}`)
    .join('\n')

  const user = `Company facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nFill these keys:\n${fieldList}\n\nReturn the JSON object now.`

  let raw: string
  try {
    const client = createAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    })
    raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI request failed' },
      { status: 502 },
    )
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw
  let parsed: { values?: Record<string, unknown>; rationale?: unknown }
  try {
    parsed = JSON.parse(jsonrepair(slice))
  } catch {
    return NextResponse.json({ error: 'Could not parse the AI response' }, { status: 502 })
  }

  const values = parsed.values ?? {}

  // Sanitize each field into stored units (percent → fraction), clamped.
  const cleaned: Record<string, number> = {}
  for (const [key, cfg] of Object.entries(AI_FIELDS)) {
    const v = values[key]
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) continue
    cleaned[key] = clamp(n, cfg.min, cfg.max)
  }

  // Terminal growth must stay strictly below the discount rate (compute needs it).
  if (cleaned.terminalGrowth !== undefined && cleaned.discountRate !== undefined) {
    cleaned.terminalGrowth = Math.min(cleaned.terminalGrowth, cleaned.discountRate - 0.5)
  }

  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: 'The AI returned no usable values' }, { status: 502 })
  }

  // Persist each as a manual override (create the row if it doesn't exist yet).
  const applied: Array<{ field: string; manualValue: string }> = []
  for (const [field, modelUnits] of Object.entries(cleaned)) {
    const stored = String(AI_FIELDS[field].percent ? modelUnits / 100 : modelUnits)
    const [updated] = await db
      .update(analysisInputs)
      .set({ manualValue: stored })
      .where(and(eq(analysisInputs.analysisId, id), eq(analysisInputs.field, field)))
      .returning()
    if (!updated) {
      await db
        .insert(analysisInputs)
        .values({ analysisId: id, field, fetchedValue: null, manualValue: stored, source: 'manual' })
    }
    applied.push({ field, manualValue: stored })
  }

  const computed = await recomputeAnalysis(db, id, analysis.assetId)
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : null

  return NextResponse.json({ applied, computed, rationale })
}
