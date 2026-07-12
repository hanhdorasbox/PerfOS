import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getInvestDb, analyses, analysisInputs } from '@/lib/invest/db'
import { analysisUpdateSchema } from '@/lib/invest/validation'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }
  const body = await req.json().catch(() => null)
  const parsed = analysisUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [updated] = await db
    .update(analyses)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(analyses.id, id))
    .returning()
  if (!updated) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  const computed = await recomputeAnalysis(db, id, updated.assetId)
  return NextResponse.json({ analysis: updated, computed })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }
  const db = getInvestDb()
  await db.delete(analysisInputs).where(eq(analysisInputs.analysisId, id))
  const [deleted] = await db.delete(analyses).where(eq(analyses.id, id)).returning()
  if (!deleted) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
