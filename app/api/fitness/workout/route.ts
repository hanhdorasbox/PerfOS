import { prisma } from '@/lib/db'
import { syncSourceCompletion } from '@/lib/execution-planner'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json([], { status: 400 })

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const logs = await prisma.workoutLog.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { type: true },
  })
  return NextResponse.json(logs.map(l => l.type))
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
  }

  return NextResponse.json(log)
}
