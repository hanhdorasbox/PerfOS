import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const {
      status, title, capabilityStatement, whyItMatters,
      linkedGoalId, startingLevel, targetLevel, evidenceOfMastery, finalOutput,
      roadmapType, deadline, weeklyHours, detailLevel,
      healthStatus, nextBestAction,
    } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (status !== undefined) {
      data.status = status
      if (status === 'archived') data.archivedAt = new Date()
      if (status === 'completed') data.healthStatus = 'completed'
    }
    if (title !== undefined) data.title = title
    if (capabilityStatement !== undefined) data.capabilityStatement = capabilityStatement
    if (whyItMatters !== undefined) data.whyItMatters = whyItMatters
    if (linkedGoalId !== undefined) data.linkedGoalId = linkedGoalId || null
    if (startingLevel !== undefined) data.startingLevel = startingLevel
    if (targetLevel !== undefined) data.targetLevel = targetLevel
    if (evidenceOfMastery !== undefined) data.evidenceOfMastery = evidenceOfMastery
    if (finalOutput !== undefined) data.finalOutput = finalOutput
    if (roadmapType !== undefined) data.roadmapType = roadmapType
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
    if (weeklyHours !== undefined) data.weeklyHours = weeklyHours
    if (detailLevel !== undefined) data.detailLevel = detailLevel
    if (healthStatus !== undefined) data.healthStatus = healthStatus
    if (nextBestAction !== undefined) data.nextBestAction = nextBestAction

    const goal = await prisma.capabilityGoal.update({
      where: { id },
      data,
      include: { milestones: { include: { steps: true }, orderBy: { order: 'asc' } } },
    })
    return NextResponse.json({ goal })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Delete steps → milestones → goal (cascade order)
    const milestones = await prisma.learningMilestone.findMany({ where: { capabilityGoalId: id } })
    const milestoneIds = milestones.map(m => m.id)
    if (milestoneIds.length > 0) {
      await prisma.learningStep.deleteMany({ where: { milestoneId: { in: milestoneIds } } })
      await prisma.learningMilestone.deleteMany({ where: { id: { in: milestoneIds } } })
    }
    await prisma.capabilityGoal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const goal = await prisma.capabilityGoal.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
    })
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ goal })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
