import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { name, startDate, endDate } = await req.json() as {
      name?: string
      startDate?: string
      endDate?: string
    }

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, startDate and endDate are required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

    // Deactivate any existing active quarters
    await prisma.quarter.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'closed' },
    })

    const quarter = await prisma.quarter.create({
      data: {
        userId: user.id,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'active',
      },
    })

    return NextResponse.json(quarter)
  } catch (e) {
    console.error('[POST /api/quarter]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
