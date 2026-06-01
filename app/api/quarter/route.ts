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

/** POST /api/quarter — create / upsert a single quarter by year+quarterNumber */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name?: string
      startDate?: string
      endDate?: string
      year?: number
      quarterNumber?: number
    }

    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

    // If year+quarterNumber provided, upsert cleanly
    if (body.year && body.quarterNumber) {
      const { startDate, endDate } = (() => {
        if (body.startDate && body.endDate) {
          return { startDate: new Date(body.startDate), endDate: new Date(body.endDate) }
        }
        const starts = [0, 3, 6, 9]
        const ends   = [2, 5, 8, 11]
        const q = body.quarterNumber - 1
        return {
          startDate: new Date(body.year, starts[q], 1),
          endDate:   new Date(body.year, ends[q] + 1, 0, 23, 59, 59, 999),
        }
      })()

      const status = deriveStatus(startDate, endDate)
      const name   = body.name ?? `Q${body.quarterNumber} ${body.year}`

      // Check for existing
      const existing = await prisma.quarter.findFirst({
        where: { userId: user.id, year: body.year, quarterNumber: body.quarterNumber },
      })

      const quarter = existing
        ? await prisma.quarter.update({ where: { id: existing.id }, data: { name, status } })
        : await prisma.quarter.create({
            data: { userId: user.id, year: body.year, quarterNumber: body.quarterNumber, name, startDate, endDate, status },
          })

      return NextResponse.json(quarter)
    }

    // Legacy path: freeform name+dates
    const { name, startDate, endDate } = body
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, startDate and endDate are required' }, { status: 400 })
    }

    const start  = new Date(startDate)
    const end    = new Date(endDate)
    const status = deriveStatus(start, end)

    // Only deactivate if we're creating an active quarter (legacy behaviour)
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
    console.error('[POST /api/quarter]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
