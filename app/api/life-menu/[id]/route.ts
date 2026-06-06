import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Allowed update fields
  const data: Record<string, unknown> = {}
  const fields = [
    'title', 'type', 'description', 'estimatedCost', 'actualCost', 'currency',
    'timeNeededMinutes', 'energyNeeded', 'socialMode', 'status',
    'curiosityScore', 'joyScore', 'utilityScore', 'goalSupportScore', 'regretRisk',
    'comfortZoneLevel', 'repeatPotential', 'recoveryValue', 'careerValue',
    'fitnessImpact', 'alcoholImpact', 'notesBefore', 'notesAfter',
    'plannedDate', 'triedAt', 'ratingAfter', 'linkedGoalId', 'linkedFinanceCategory', 'tags',
  ]
  for (const f of fields) {
    if (f in body) data[f] = body[f] === undefined ? null : body[f]
  }
  if (body.plannedDate) data.plannedDate = new Date(body.plannedDate)
  if (body.triedAt) data.triedAt = new Date(body.triedAt)
  if (Array.isArray(body.tags)) data.tags = JSON.stringify(body.tags)

  const item = await prisma.lifeMenuItem.update({ where: { id }, data })

  // If scheduled → create WeeklyTask
  if (body.createTask && body.userId && body.weeklyPlanId) {
    await prisma.weeklyTask.create({
      data: {
        weeklyPlanId: body.weeklyPlanId,
        title: `Try: ${item.title}`,
        effort: 2,
        priority: 2,
        status: 'active',
        sourceModule: 'life_menu',
        sourceType: 'life_menu_item',
        sourceId: item.id,
      },
    }).catch(() => {})
  }

  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.lifeMenuItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
