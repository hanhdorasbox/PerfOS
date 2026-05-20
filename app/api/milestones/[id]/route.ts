import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const milestone = await prisma.milestone.findUnique({ where: { id } })
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const completed = !milestone.completed
  const updated = await prisma.milestone.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  })
  return NextResponse.json(updated)
}
