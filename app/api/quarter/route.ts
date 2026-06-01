import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deriveStatus, getOrCreateYearQuarters } from '@/lib/quarters'

/** GET /api/quarter?year=2026 — return all 4 quarters for a year */
export async function GET(req: NextRequest) {
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))
  const user = await prisma.user.findFirst()
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })
  const quarters = await getOrCreateYearQuarters(user.id, year)
  return NextResponse.json(quarters)
}

/** POST /api/quarter — create a quarter (freeform name+dates, legacy path) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; startDate?: string; endDate?: string }
    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

    const { name, startDate, endDate } = body
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, startDate and endDate are required' }, { status: 400 })
    }

    const start  = new Date(startDate)
    const end    = new Date(endDate)
    const status = deriveStatus(start, end)

    if (status === 'active') {
      await prisma.quarter.updateMany({
        where: { userId: user.id, status: 'active' },
        data:  { status: 'closed' },
      })
    }

    const quarter = await prisma.quarter.create({
      data: { userId: user.id, name, startDate: start, endDate: end, status },
    })
    return NextResponse.json(quarter)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
