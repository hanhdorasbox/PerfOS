import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const {
      userId, title, capabilityStatement, whyItMatters,
      linkedGoalId, startingLevel, targetLevel,
      evidenceOfMastery, finalOutput,
      roadmapType, deadline, weeklyHours, detailLevel,
    } = await req.json()

    if (!userId || !title || !capabilityStatement) {
      return NextResponse.json({ error: 'userId, title, capabilityStatement required' }, { status: 400 })
    }

    // Base fields — guaranteed to exist in all DB versions
    const baseData = {
      userId,
      title,
      capabilityStatement,
      whyItMatters: whyItMatters ?? null,
      linkedGoalId: linkedGoalId || null,
      startingLevel: startingLevel ?? 1,
      targetLevel: targetLevel ?? 4,
      evidenceOfMastery: evidenceOfMastery ?? null,
      finalOutput: finalOutput ?? null,
      status: 'active',
    }

    // New fields added in the learning-roadmap upgrade — may not exist yet
    // if prisma db push hasn't run on this deployment. Try with them first,
    // fall back to base-only if the DB is still behind.
    let goal
    try {
      goal = await prisma.capabilityGoal.create({
        data: {
          ...baseData,
          roadmapType: roadmapType ?? null,
          deadline: deadline ? new Date(deadline) : null,
          weeklyHours: weeklyHours ?? null,
          detailLevel: detailLevel ?? 'standard',
          healthStatus: 'not_started',
        },
      })
    } catch (createErr) {
      const msg = createErr instanceof Error ? createErr.message : ''
      if (msg.includes('does not exist')) {
        // Schema not migrated yet — create with base fields only
        goal = await prisma.capabilityGoal.create({ data: baseData })
      } else {
        throw createErr
      }
    }

    return NextResponse.json({ goal })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  try {
    const goals = await prisma.capabilityGoal.findMany({
      where: { userId },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ goals })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
