import { prisma } from '@/lib/db'
import { syncSourceCompletion } from '@/lib/execution-planner'
import { NextRequest, NextResponse } from 'next/server'

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
