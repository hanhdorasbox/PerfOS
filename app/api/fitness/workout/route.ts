import { prisma } from '@/lib/db'
import { syncSourceCompletion } from '@/lib/execution-planner'
import { NextRequest, NextResponse } from 'next/server'

function currentWeekId(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json([], { status: 400 })

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const [logs, scheduleCompleted] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { type: true },
    }),
    // Also include sessions marked done via the strategy view (FitnessScheduleChange)
    prisma.fitnessScheduleChange.findMany({
      where: { userId, weekId: currentWeekId(), action: 'completed', undone: false },
      select: { sessionLabel: true },
    }).catch(() => [] as { sessionLabel: string }[]),
  ])

  const types = [...new Set([
    ...logs.map(l => l.type),
    ...scheduleCompleted.map(c => c.sessionLabel),
  ])]
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const { userId, type, duration, notes, linkedWeeklyTaskId } = await req.json()
  const log = await prisma.workoutLog.create({
    data: { userId, type, duration, notes, date: new Date(), linkedWeeklyTaskId: linkedWeeklyTaskId ?? null },
  })

  // Bidirectional sync: if a task was explicitly linked, mark it done
  if (linkedWeeklyTaskId) {
    await prisma.weeklyTask.updateMany({
      where: { id: linkedWeeklyTaskId, completed: false },
      data: { completed: true, completedAt: new Date(), status: 'done' },
    }).catch(() => {})
    await syncSourceCompletion(linkedWeeklyTaskId, true).catch(() => {})
  } else {
    // Auto-complete matching fitness weekly task by name similarity
    await autoCompleteWorkoutTask(userId, type).catch(() => {})
  }

  return NextResponse.json(log)
}

/** Find and complete the best-matching uncompleted fitness task for this workout. */
async function autoCompleteWorkoutTask(userId: string, workoutType: string): Promise<void> {
  const plan = await prisma.weeklyPlan.findFirst({
    where: { userId, status: 'active' },
    include: {
      tasks: {
        where: { completed: false, sourceModule: 'fitness' },
        select: { id: true, title: true },
      },
    },
    orderBy: { weekStart: 'desc' },
  })
  if (!plan?.tasks.length) return

  const typeLC = workoutType.toLowerCase()
  const match =
    plan.tasks.find(t => t.title.toLowerCase() === typeLC) ??
    plan.tasks.find(t => typeLC.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(typeLC)) ??
    plan.tasks.find(t => {
      const words = typeLC.split(/\s+/).filter(w => w.length > 3)
      return words.some(w => t.title.toLowerCase().includes(w))
    })

  if (match) {
    await prisma.weeklyTask.update({
      where: { id: match.id },
      data: { completed: true, completedAt: new Date(), status: 'done' },
    })
    await syncSourceCompletion(match.id, true).catch(() => {})
  }
}
