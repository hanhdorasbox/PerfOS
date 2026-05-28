import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/habits/alcohol/settings?userId=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const settings = await prisma.alcoholSettings.findUnique({ where: { userId } })
  return NextResponse.json({ settings })
}

// PATCH /api/habits/alcohol/settings
export async function PATCH(req: NextRequest) {
  try {
    const { userId, budgetType, weeklyBudget, goal, damageControlEnabled } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const settings = await prisma.alcoholSettings.upsert({
      where: { userId },
      create: {
        userId,
        budgetType: budgetType ?? 'flexible',
        weeklyBudget: weeklyBudget ?? 2,
        goal: goal ?? 'fat_loss',
        damageControlEnabled: damageControlEnabled ?? true,
      },
      update: {
        ...(budgetType != null && { budgetType }),
        ...(weeklyBudget != null && { weeklyBudget: Number(weeklyBudget) }),
        ...(goal != null && { goal }),
        ...(damageControlEnabled != null && { damageControlEnabled: Boolean(damageControlEnabled) }),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ settings })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
