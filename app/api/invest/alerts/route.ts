import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getInvestDb, alertEvents, alertRules } from '@/lib/invest/db'
import { alertRuleCreateSchema, alertRuleUpdateSchema } from '@/lib/invest/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getInvestDb()
  const rules = await db.select().from(alertRules)
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = alertRuleCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const db = getInvestDb()
  const [created] = await db
    .insert(alertRules)
    .values({
      name: parsed.data.name,
      type: parsed.data.type,
      params: parsed.data.params,
      cooldownHours: parsed.data.cooldownHours,
      isActive: parsed.data.isActive,
    })
    .returning()
  return NextResponse.json({ rule: created }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = alertRuleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const db = getInvestDb()
  const { id, ...patch } = parsed.data
  const [updated] = await db.update(alertRules).set(patch).where(eq(alertRules.id, id)).returning()
  if (!updated) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
  return NextResponse.json({ rule: updated })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID (?id=)' }, { status: 400 })
  }
  const db = getInvestDb()
  await db.delete(alertEvents).where(eq(alertEvents.ruleId, id))
  const [deleted] = await db.delete(alertRules).where(eq(alertRules.id, id)).returning()
  if (!deleted) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
