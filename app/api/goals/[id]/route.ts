import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Delete / null-out all dependent records first
    await prisma.progressUpdate.deleteMany({ where: { goalId: id } })
    await prisma.milestone.deleteMany({ where: { goalId: id } })
    // WeeklyTask has optional goalId — null it out rather than delete the tasks
    await prisma.weeklyTask.updateMany({ where: { goalId: id }, data: { goalId: null } })
    // CareerCapitalGoalEval has required goalId
    await prisma.careerCapitalGoalEval.deleteMany({ where: { goalId: id } })
    // CapabilityGoal has optional linkedGoalId
    await prisma.capabilityGoal.updateMany({ where: { linkedGoalId: id }, data: { linkedGoalId: null } })
    await prisma.goal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[goals DELETE]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as Partial<{
      title: string
      category: string
      trackingType: string
      strategicRole: string | null
      startValue: number | null
      targetValue: number | null
      currentValue: number | null
      unit: string | null
      deadline: string
      priorityWeight: number
      status: string
    }>

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) {
      if (!body.title?.trim()) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      data.title = body.title.trim()
    }
    if (body.category !== undefined) data.category = body.category
    if (body.trackingType !== undefined) data.trackingType = body.trackingType
    if (body.strategicRole !== undefined) data.strategicRole = body.strategicRole
    if (body.startValue !== undefined) data.startValue = body.startValue
    if (body.targetValue !== undefined) data.targetValue = body.targetValue
    if (body.currentValue !== undefined) data.currentValue = body.currentValue
    if (body.unit !== undefined) data.unit = body.unit
    if (body.deadline !== undefined) {
      const d = new Date(body.deadline)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'deadline must be a valid date' }, { status: 400 })
      data.deadline = d
    }
    if (body.priorityWeight !== undefined) data.priorityWeight = body.priorityWeight
    if (body.status !== undefined) data.status = body.status

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const goal = await prisma.goal.update({ where: { id }, data })
    return NextResponse.json(goal)
  } catch (e) {
    console.error('[goals PATCH]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
