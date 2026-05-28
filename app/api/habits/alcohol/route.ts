import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/habits/alcohol?userId=&weeks=8
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const weeks = parseInt(searchParams.get('weeks') ?? '8', 10)
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const logs = await prisma.alcoholLog.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ logs })
}

// POST /api/habits/alcohol
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, date, drinks, occasion, afterWorkout, beforeWorkoutDay,
            sleepHours, sleepQuality, nextDayEnergy, missedWorkout, missedSteps,
            proteinHit, calorieOverage, hadCravings, moodScore, recoveryRating, notes } = body

    if (!userId || !date || drinks == null) {
      return NextResponse.json({ error: 'userId, date, drinks required' }, { status: 400 })
    }

    const log = await prisma.alcoholLog.create({
      data: {
        userId,
        date: new Date(date),
        drinks: Number(drinks),
        occasion: occasion ?? null,
        afterWorkout: Boolean(afterWorkout),
        beforeWorkoutDay: Boolean(beforeWorkoutDay),
        sleepHours: sleepHours != null ? Number(sleepHours) : null,
        sleepQuality: sleepQuality != null ? Number(sleepQuality) : null,
        nextDayEnergy: nextDayEnergy != null ? Number(nextDayEnergy) : null,
        missedWorkout: Boolean(missedWorkout),
        missedSteps: Boolean(missedSteps),
        proteinHit: proteinHit != null ? Boolean(proteinHit) : null,
        calorieOverage: calorieOverage != null ? Number(calorieOverage) : null,
        hadCravings: Boolean(hadCravings),
        moodScore: moodScore != null ? Number(moodScore) : null,
        recoveryRating: recoveryRating != null ? Number(recoveryRating) : null,
        notes: notes ?? null,
      },
    })

    return NextResponse.json({ log })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
