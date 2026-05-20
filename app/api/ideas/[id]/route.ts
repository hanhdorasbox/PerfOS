import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const data = await req.json()
    const idea = await prisma.idea.update({
      where: { id },
      data: {
        status: data.status ?? undefined,
        aiEvaluation: data.aiEvaluation ?? undefined,
        nextStep: data.nextStep ?? undefined,
        domain: data.domain ?? undefined,
        effortEstimate: data.effortEstimate ?? undefined,
        isTimeSensitive: data.isTimeSensitive ?? undefined,
        isHighUpsideBet: data.isHighUpsideBet ?? undefined,
        description: data.description ?? undefined,
      },
    })
    return NextResponse.json({ idea })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
