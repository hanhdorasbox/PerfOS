import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { calcMilestoneProgress } from '@/lib/calculations'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const milestone = await prisma.milestone.findUnique({
    where: { id },
    include: { goal: { select: { quarterId: true } } },
  })
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quarter = await prisma.quarter.findUnique({
    where: { id: milestone.goal.quarterId },
    select: { status: true },
  })
  if (quarter?.status === 'closed') {
    return NextResponse.json({ error: 'Cannot update milestones in closed quarters' }, { status: 403 })
  }

  const completed = !milestone.completed

  // Compute new progress % after the toggle (using current state of all siblings)
  const allMilestones = await prisma.milestone.findMany({
    where: { goalId: milestone.goalId },
  })
  const simulatedMilestones = allMilestones.map(m =>
    m.id === id ? { ...m, completed } : m
  )
  const newProgressPct = calcMilestoneProgress(simulatedMilestones)

  // Atomic: toggle milestone + snapshot progress for chart history + update goal.currentValue
  const [updated] = await prisma.$transaction([
    prisma.milestone.update({
      where: { id },
      data: { completed, completedAt: completed ? new Date() : null },
    }),
    prisma.progressUpdate.create({
      data: {
        goalId: milestone.goalId,
        value: newProgressPct,
        note: `auto: milestone ${completed ? 'completed' : 'uncompleted'}`,
      },
    }),
    prisma.goal.update({
      where: { id: milestone.goalId },
      data: { currentValue: newProgressPct, updatedAt: new Date() },
    }),
  ])

  return NextResponse.json(updated)
}
