import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { strategyId: string; weeklySchedule?: { day: string; sessions: string[] }[]; workoutPlan?: unknown }
    const { strategyId, weeklySchedule, workoutPlan } = body

    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId required' }, { status: 400 })
    }

    const data: Record<string, string> = {}
    if (weeklySchedule) data.weeklySchedule = JSON.stringify(weeklySchedule)
    if (workoutPlan)   data.workoutPlan    = JSON.stringify(workoutPlan)

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.fitnessStrategy.update({ where: { id: strategyId }, data })

    return NextResponse.json({ ok: true, weeklySchedule: updated.weeklySchedule, workoutPlan: updated.workoutPlan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
