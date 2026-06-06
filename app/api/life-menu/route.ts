import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json([], { status: 400 })

  const items = await prisma.lifeMenuItem.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, type, description, estimatedCost, currency, timeNeededMinutes,
    energyNeeded, socialMode, status, curiosityScore, joyScore, utilityScore,
    goalSupportScore, regretRisk, comfortZoneLevel, repeatPotential, recoveryValue,
    careerValue, fitnessImpact, alcoholImpact, notesBefore, linkedGoalId, tags } = body

  if (!userId || !title || !type) {
    return NextResponse.json({ error: 'userId, title, type required' }, { status: 400 })
  }

  const item = await prisma.lifeMenuItem.create({
    data: {
      userId, title, type,
      description: description ?? null,
      tags: tags ? JSON.stringify(tags) : null,
      estimatedCost: estimatedCost ?? null,
      currency: currency ?? 'CZK',
      timeNeededMinutes: timeNeededMinutes ?? null,
      energyNeeded: energyNeeded ?? 'medium',
      socialMode: socialMode ?? 'either',
      status: status ?? 'idea',
      curiosityScore: curiosityScore ?? null,
      joyScore: joyScore ?? null,
      utilityScore: utilityScore ?? null,
      goalSupportScore: goalSupportScore ?? null,
      regretRisk: regretRisk ?? null,
      comfortZoneLevel: comfortZoneLevel ?? null,
      repeatPotential: repeatPotential ?? null,
      recoveryValue: recoveryValue ?? null,
      careerValue: careerValue ?? null,
      fitnessImpact: fitnessImpact ?? 'neutral',
      alcoholImpact: alcoholImpact ?? 'none',
      notesBefore: notesBefore ?? null,
      linkedGoalId: linkedGoalId ?? null,
    },
  })
  return NextResponse.json(item)
}
