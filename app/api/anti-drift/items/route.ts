import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/quarters'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, category, domain, impact } = body

  const now = new Date()
  const { monday: weekStart } = getWeekBounds()

  const item = await prisma.workItem.create({
    data: {
      userId,
      title,
      category,
      domain,
      impact: impact || null,
      completedAt: now,
      weekStart,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.workItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
