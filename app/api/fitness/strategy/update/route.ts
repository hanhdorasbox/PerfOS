import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { strategyId: string; weeklySchedule: { day: string; sessions: string[] }[] }
    const { strategyId, weeklySchedule } = body

    if (!strategyId || !weeklySchedule) {
      return NextResponse.json({ error: 'strategyId and weeklySchedule required' }, { status: 400 })
    }

    const updated = await prisma.fitnessStrategy.update({
      where: { id: strategyId },
      data: { weeklySchedule: JSON.stringify(weeklySchedule) },
    })

    return NextResponse.json({ ok: true, weeklySchedule: updated.weeklySchedule })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
