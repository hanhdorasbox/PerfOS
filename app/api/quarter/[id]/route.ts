import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as Partial<{ name: string; startDate: string; endDate: string; status: string }>

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      data.name = body.name.trim()
    }
    if (body.startDate !== undefined) {
      const d = new Date(body.startDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'startDate must be a valid date' }, { status: 400 })
      data.startDate = d
    }
    if (body.endDate !== undefined) {
      const d = new Date(body.endDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'endDate must be a valid date' }, { status: 400 })
      data.endDate = d
    }
    if (body.status !== undefined) data.status = body.status

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const quarter = await prisma.quarter.update({ where: { id }, data })
    return NextResponse.json(quarter)
  } catch (e) {
    console.error('[quarter PATCH]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
