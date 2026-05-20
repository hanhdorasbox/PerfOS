import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

    // ── Generate concrete weekly tasks from workout plan ──────────────────────
    const weeklySchedule: { day: string; sessions: string[] }[] = (() => {
      try { return JSON.parse(strategy.weeklySchedule || '[]') } catch { return [] }
    })()
    const workoutPlan: { days: { label: string; theme: string }[] } | null = (() => {
      try { return JSON.parse((strategy as unknown as Record<string, unknown>).workoutPlan as string || 'null') } catch { return null }
    })()

    // Find the active quarter and its current weekly plan
    const quarter = await prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      include: {
        weeklyPlans: {
          where: { status: 'active' },
          orderBy: { weekStart: 'desc' },
          take: 1,
        },
      },
    })

    const weeklyPlan = quarter?.weeklyPlans[0]

    if (weeklyPlan && weeklySchedule.length > 0) {
      // Build label→theme lookup
      const workoutMeta = new Map<string, string>()
      if (workoutPlan?.days) {
        for (const d of workoutPlan.days) {
          workoutMeta.set(d.label.toLowerCase(), d.theme)
        }
      }

      // For each strength session in the schedule, create a task if not already present
      for (const schedDay of weeklySchedule) {
        for (const session of schedDay.sessions || []) {
          const isStrength = /\b(body|upper|lower|push|pull|full|strength|hypertrophy|leg|chest|back|shoulder)\b/i.test(session)
          if (!isStrength) continue

          const theme = workoutMeta.get(session.toLowerCase())
          const taskTitle = theme
            ? `${session} — ${theme}`
            : `Complete ${session} workout`

          const existing = await prisma.weeklyTask.findFirst({
            where: { weeklyPlanId: weeklyPlan.id, title: taskTitle },
          })
          if (!existing) {
            await prisma.weeklyTask.create({
              data: {
                weeklyPlanId: weeklyPlan.id,
                title: taskTitle,
                completed: false,
                effort: 3,
                taskType: 'workout',
              },
            })
          }
        }
      }
    }

    return NextResponse.json(strategy)
  } catch (e) {
    console.error('[activate strategy]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
