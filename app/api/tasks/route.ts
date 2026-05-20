import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { weeklyPlanId, title, effort, goalId } = await req.json()
  const task = await prisma.weeklyTask.create({
    data: { weeklyPlanId, title, effort: Number(effort) || 2, goalId: goalId || null, completed: false },
  })
  return NextResponse.json(task)
}
