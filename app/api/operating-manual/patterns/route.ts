import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const patterns = await prisma.behaviorPattern.findMany({
    where: { userId, active: true },
    orderBy: { domain: 'asc' },
  })
  return NextResponse.json({ patterns })
}

export async function POST(req: NextRequest) {
  try {
    const { userId, domain, pattern, evidence, confidence, implication } = await req.json()
    if (!userId || !domain || !pattern) {
      return NextResponse.json({ error: 'userId, domain, pattern required' }, { status: 400 })
    }

    const created = await prisma.behaviorPattern.create({
      data: {
        userId,
        domain,
        pattern,
        evidence: evidence ?? null,
        confidence: typeof confidence === 'number' ? Math.min(5, Math.max(1, confidence)) : 3,
        implication: implication ?? null,
        active: true,
      },
    })
    return NextResponse.json({ pattern: created })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.behaviorPattern.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
