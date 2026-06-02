import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { completed, evidence, title, description, estimatedMinutes, completionCriteria, suggestedDay } = await req.json()

    const step = await prisma.learningStep.findUnique({
      where: { id },
      include: { goal: { select: { quarterId: true, quarter: { select: { status: true } } } } },
    })
    if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (step.goal?.quarter?.status === 'closed') {
      return NextResponse.json({ error: 'Cannot update learning steps in closed quarters' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (completed !== undefined) {
      data.completed = Boolean(completed)
      data.completedAt = completed ? new Date() : null
    }
    if (evidence !== undefined) data.evidence = evidence
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (estimatedMinutes !== undefined) data.estimatedMinutes = estimatedMinutes
    if (completionCriteria !== undefined) data.completionCriteria = completionCriteria
    if (suggestedDay !== undefined) data.suggestedDay = suggestedDay

    const updated = await prisma.learningStep.update({ where: { id }, data })

    // Bidirectional sync: if step was just marked complete, auto-complete linked WeeklyTask(s)
    if (data.completed === true) {
      await prisma.weeklyTask.updateMany({
        where: { sourceModule: 'learning', sourceId: id, completed: false },
        data: { completed: true, completedAt: new Date() },
      }).catch(() => {})
    }

    // If step was un-completed, un-complete linked WeeklyTask(s)
    if (data.completed === false) {
      await prisma.weeklyTask.updateMany({
        where: { sourceModule: 'learning', sourceId: id, completed: true },
        data: { completed: false, completedAt: null },
      }).catch(() => {})
    }

    return NextResponse.json({ step: updated })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const step = await prisma.learningStep.findUnique({
      where: { id },
      include: { goal: { select: { quarterId: true, quarter: { select: { status: true } } } } },
    })
    if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (step.goal?.quarter?.status === 'closed') {
      return NextResponse.json({ error: 'Cannot delete learning steps in closed quarters' }, { status: 403 })
    }

    await prisma.learningStep.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
