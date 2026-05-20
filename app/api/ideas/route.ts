import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const ideas = await prisma.idea.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ ideas })
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId, title, description, domain, possibleUpside,
      effortEstimate, isTimeSensitive, supportsGoalId, isHighUpsideBet,
    } = await req.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId and title required' }, { status: 400 })
    }

    const idea = await prisma.idea.create({
      data: {
        userId,
        title,
        description: description ?? null,
        domain: domain || null,
        possibleUpside: possibleUpside ?? null,
        effortEstimate: effortEstimate || null,
        isTimeSensitive: Boolean(isTimeSensitive),
        supportsGoalId: supportsGoalId || null,
        isHighUpsideBet: Boolean(isHighUpsideBet),
        status: 'inbox',
      },
    })
    return NextResponse.json({ idea })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
