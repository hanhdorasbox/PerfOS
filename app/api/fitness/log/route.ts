import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      userId: string
      date?: string
      weight?: number | null
      waist?: number | null
      hip?: number | null
      notes?: string | null
    }
    const { userId, date, weight, waist, hip, notes } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const logDate = date ? new Date(date) : new Date()
    if (isNaN(logDate.getTime())) {
      return NextResponse.json({ error: 'date must be a valid date' }, { status: 400 })
    }

    // Build UTC day window to avoid timezone-dependent toDateString() parsing
    const startOfDay = new Date(Date.UTC(
      logDate.getUTCFullYear(), logDate.getUTCMonth(), logDate.getUTCDate()
    ))
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

    // Upsert: if a log already exists for this UTC day, update it
    const existing = await prisma.fitnessLog.findFirst({
      where: { userId, date: { gte: startOfDay, lt: endOfDay } },
    })

    let log
    if (existing) {
      log = await prisma.fitnessLog.update({
        where: { id: existing.id },
        data: {
          // Use undefined-check so callers can explicitly send null to clear a field
          weight:  weight  !== undefined ? weight  : existing.weight,
          waist:   waist   !== undefined ? waist   : existing.waist,
          hip:     hip     !== undefined ? hip     : existing.hip,
          notes:   notes   !== undefined ? notes   : existing.notes,
        },
      })
    } else {
      log = await prisma.fitnessLog.create({
        data: {
          userId,
          date: startOfDay,  // normalise to UTC midnight
          weight:  weight  ?? null,
          waist:   waist   ?? null,
          hip:     hip     ?? null,
          notes:   notes   ?? null,
        },
      })
    }

    return NextResponse.json(log)
  } catch (e) {
    console.error('[fitness/log POST]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const logs = await prisma.fitnessLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 60,
    })
    return NextResponse.json(logs)
  } catch (e) {
    console.error('[fitness/log GET]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
