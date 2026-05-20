import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, food, type, notes } = body
  const pref = await prisma.foodPreference.create({
    data: { userId, food, type, notes: notes || null },
  })
  return NextResponse.json(pref)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.foodPreference.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
