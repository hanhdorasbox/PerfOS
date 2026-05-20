import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      title,
      capabilityStatement,
      whyItMatters,
      linkedGoalId,
      startingLevel,
      targetLevel,
      evidenceOfMastery,
      finalOutput,
    } = await req.json()

    if (!userId || !title || !capabilityStatement) {
      return NextResponse.json({ error: 'userId, title, capabilityStatement required' }, { status: 400 })
    }

    const goal = await prisma.capabilityGoal.create({
      data: {
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
      },
    })

    return NextResponse.json({ goal })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
