import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, category, domain, impact } = body

  const now = new Date()
  const day = now.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)

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
