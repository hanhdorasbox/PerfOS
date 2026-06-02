import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/quarters'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, category, domain, impact } = body

  if (!userId || !title?.trim() || !category) {
    return NextResponse.json({ error: 'userId, title, and category required' }, { status: 400 })
  }

  const now = new Date()
  const { monday: weekStart } = getWeekBounds()

  const item = await prisma.workItem.create({
    data: {
      userId,
      title: title.trim(),
      category,
      domain: domain || null,
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
