import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { value, note } = await req.json()
  await prisma.progressUpdate.create({ data: { goalId: id, value: parseFloat(value), note } })
  await prisma.goal.update({ where: { id }, data: { currentValue: parseFloat(value), updatedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
