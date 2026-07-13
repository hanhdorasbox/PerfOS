import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
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
import { computeValuation } from '@/lib/invest/valuation/compute'
import { CHECKLIST_ITEMS, normalizeChecklist } from '@/lib/invest/valuation/checklist'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

// Generates a first-draft due-diligence assessment for each checklist item
// from the ticker + the numbers we already have. It's a starting point to
// edit and verify, NOT investment advice — the model can't see live filings.
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

  const computed = computeValuation(inputs, latestPrice?.price ?? null)

  const facts = {
    ticker: asset.ticker,
    name: asset.name,
    sector: asset.sector ?? 'unknown',
    currency: asset.currency,
    currentPrice: latestPrice?.price ?? null,
    fairValueDcf: computed.fairValue,
    impliedPe: computed.impliedFromPe,
    impliedEvEbitda: computed.impliedFromEvEbitda,
    marginOfSafety: computed.marginOfSafety,
    fundamentals: fundamentals?.data ?? null,
  }

  const itemList = CHECKLIST_ITEMS.map((i) => `- ${i.key} (${i.group}): ${i.label} — good = ${i.hint}`).join('\n')

  const system = [
    'You are an equity due-diligence assistant helping a retail investor pressure-test a buy decision.',
    'You are given a company, the numbers already computed, and a checklist of factors.',
    'For each checklist item, give a short, concrete assessment (1–3 sentences) grounded in what is generally known about this company and the numbers provided, and assign a status.',
    'status must be one of: pass (looks good), concern (mixed / needs a closer look), fail (clear problem), pending (not enough information).',
    'Be honest and specific to THIS company — no generic filler. Where you are relying on general knowledge rather than the supplied numbers, say so briefly so the user knows to verify.',
    'You cannot see live filings or current news, so prefer "concern" or "pending" over false confidence, and never state a definitive buy/sell recommendation.',
    'Respond with ONLY a JSON object of the form {"items": {"<key>": {"status": "...", "notes": "..."}}}, using exactly the item keys given.',
  ].join(' ')

  const user = `Company facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nChecklist items:\n${itemList}\n\nReturn the JSON object now.`

  let raw: string
  try {
    const client = createAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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

  // The model may wrap the JSON in prose or fences — extract the object.
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonrepair(slice))
  } catch {
    return NextResponse.json({ error: 'Could not parse the AI response' }, { status: 502 })
  }

  const items = (parsed as { items?: unknown })?.items ?? parsed
  const suggestion = normalizeChecklist(items)
  return NextResponse.json({ checklist: suggestion })
}
