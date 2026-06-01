import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planTasks } from '@/lib/execution-planner'

export async function POST(req: NextRequest) {
  const { userId, strategyId } = await req.json() as { userId: string; strategyId: string }
  if (!userId || !strategyId) return NextResponse.json({ error: 'userId and strategyId required' }, { status: 400 })

  try {
    // Deactivate all previous active strategies
    await prisma.fitnessStrategy.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'inactive' },
    })

    const strategy = await prisma.fitnessStrategy.update({
      where: { id: strategyId },
      data: { status: 'active' },
    })

    // ── Generate WeeklyTasks from weekly schedule via ExecutionPlanner ────────
    const weeklySchedule: { day: string; sessions: string[] }[] = (() => {
      try { return JSON.parse(strategy.weeklySchedule || '[]') } catch { return [] }
    })()
    const workoutPlan: { days: { label: string; theme: string }[] } | null = (() => {
      try { return JSON.parse((strategy as unknown as Record<string, unknown>).workoutPlan as string || 'null') } catch { return null }
    })()

    if (weeklySchedule.length > 0) {
      const workoutMeta = new Map<string, string>()
      if (workoutPlan?.days) {
        for (const d of workoutPlan.days) workoutMeta.set(d.label.toLowerCase(), d.theme)
      }

      const candidates = weeklySchedule.flatMap(schedDay =>
        (schedDay.sessions ?? [])
          .filter(session => /\b(body|upper|lower|push|pull|full|strength|hypertrophy|leg|chest|back|shoulder)\b/i.test(session))
          .map(session => {
            const theme = workoutMeta.get(session.toLowerCase())
            const title = theme ? `${session} — ${theme}` : `Complete ${session} workout`
            return {
              title,
              domain: 'fitness' as const,
              taskType: 'workout' as const,
              priority: 'should' as const,
              effort: 'deep' as const,
              sourceModule: 'fitness',
              sourceType: 'fitness_schedule_item',
              sourceId: `${strategyId}:${schedDay.day}:${session}`,
              createdBy: 'system' as const,
            }
          })
      )

      if (candidates.length > 0) {
        await planTasks(userId, candidates).catch(() => {})
      }
    }

    return NextResponse.json(strategy)
  } catch (e) {
    console.error('[activate strategy]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
