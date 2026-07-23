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

// The judgment inputs the model estimates. Hard fundamentals (FCF, net debt,
// beta, shares, EPS, EBITDA…) stay fetched from the API and are NOT touched.
// `percent` fields are asked for in percentage points (e.g. 8 = 8%) and stored
// as a fraction (0.08); `number` fields are stored as-is. min/max are sanity
// clamps in the model's units.
const AI_FIELDS: Record<string, { percent: boolean; min: number; max: number }> = {
  fcfGrowthY1: { percent: true, min: -40, max: 60 },
  fcfGrowthY2: { percent: true, min: -40, max: 55 },
  fcfGrowthY3: { percent: true, min: -40, max: 50 },
  fcfGrowthY4: { percent: true, min: -40, max: 45 },
  fcfGrowthY5: { percent: true, min: -40, max: 40 },
  terminalGrowth: { percent: true, min: 0, max: 4 },
  discountRate: { percent: true, min: 4, max: 20 },
  riskFreeRate: { percent: true, min: 0, max: 10 },
  equityRiskPremium: { percent: true, min: 3, max: 8 },
  costOfDebt: { percent: true, min: 0, max: 15 },
  taxRate: { percent: true, min: 0, max: 40 },
  peBenchmark: { percent: false, min: 3, max: 60 },
  evEbitdaBenchmark: { percent: false, min: 2, max: 40 },
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// Suggests the DCF/relative-valuation *assumptions* for a ticker and writes them
// as manual overrides, then recomputes. The model can't see live filings, so
// these are a starting point to verify — never advice, and the fetched
// fundamentals stay authoritative.
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
    'You are a valuation assistant helping a retail investor set the ASSUMPTIONS for a 5-year FCFF discounted-cash-flow model.',
    'You are given a company and the hard fundamentals already fetched from a data API.',
    'Estimate only the judgment inputs listed below, tailored to THIS company and its sector, grounded in what is generally known about it.',
    'Rules: FCF growth must fade DOWN from year 1 to year 5 toward the terminal rate (no flat high growth). Terminal growth must be at or below long-run GDP (~2–3%) and strictly below the discount rate. The discount rate should be a realistic WACC for this company. Risk-free rate ≈ the current 10-year government-bond yield for the listing currency. Equity risk premium ≈ 4.5–5.5%.',
    'You cannot see live filings or prices, so these are estimates to verify — never a buy/sell recommendation.',
    'Return ONLY a JSON object: {"values": {"<key>": <number>}, "rationale": "<one or two sentences>"}.',
    'percent fields are in PERCENTAGE POINTS (e.g. 8 means 8%). peBenchmark and evEbitdaBenchmark are plain multiples (e.g. 22).',
  ].join(' ')

  const fieldList = Object.entries(AI_FIELDS)
    .map(([k, c]) => `- ${k}${c.percent ? ' (percent points)' : ' (multiple)'}`)
    .join('\n')

  const user = `Company facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nEstimate these keys:\n${fieldList}\n\nReturn the JSON object now.`

  let raw: string
  try {
    const client = createAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
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
