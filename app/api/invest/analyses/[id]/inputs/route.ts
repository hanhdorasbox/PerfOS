import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getInvestDb, analyses, analysisInputs } from '@/lib/invest/db'
import { analysisInputPutSchema } from '@/lib/invest/validation'
import { isKnownField } from '@/lib/invest/valuation/fields'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

// Set (or reset with null) the manual override of one input field.
// fetched_value is untouchable here — only the refetch endpoint updates it.
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }
  const body = await req.json().catch(() => null)
  const parsed = analysisInputPutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  if (!isKnownField(parsed.data.field)) {
    return NextResponse.json({ error: `Unknown field ${parsed.data.field}` }, { status: 400 })
  }

  const db = getInvestDb()
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1)
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const patch: { manualValue: string | null; note?: string | null } = {
    manualValue: parsed.data.manualValue === null ? null : String(parsed.data.manualValue),
  }
  if (parsed.data.note !== undefined) patch.note = parsed.data.note

  const [updated] = await db
    .update(analysisInputs)
    .set(patch)
    .where(and(eq(analysisInputs.analysisId, id), eq(analysisInputs.field, parsed.data.field)))
    .returning()

  if (!updated) {
    // Field row missing (e.g. added to FIELD_DEFS after the analysis was created)
    const [created] = await db
      .insert(analysisInputs)
      .values({
        analysisId: id,
        field: parsed.data.field,
        fetchedValue: null,
        manualValue: patch.manualValue,
        note: patch.note ?? null,
        source: 'manual',
      })
      .returning()
    const computed = await recomputeAnalysis(db, id, analysis.assetId)
    return NextResponse.json({ input: created, computed })
  }

  const computed = await recomputeAnalysis(db, id, analysis.assetId)
  return NextResponse.json({ input: updated, computed })
}
