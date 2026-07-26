import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RoutineRow {
  id: string
  name: string
  exercises: string
  createdAt: Date
}

function serialize(r: RoutineRow) {
  let exercises: unknown = []
  try {
    exercises = JSON.parse(r.exercises)
  } catch {
    exercises = []
  }
  return { id: r.id, name: r.name, exercises, createdAt: r.createdAt.toISOString() }
}

export async function GET() {
  const user = await prisma.user.findFirst()
  if (!user) return NextResponse.json({ routines: [] })
  const rows = await prisma.workoutRoutine.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ routines: rows.map(serialize) })
}

export async function POST(req: NextRequest) {
  const user = await prisma.user.findFirst()
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const rawExercises = Array.isArray(body?.exercises) ? body.exercises : null
  if (!name || !rawExercises || rawExercises.length === 0) {
    return NextResponse.json({ error: 'Name and at least one exercise are required' }, { status: 400 })
  }

  const exercises = rawExercises
    .map((e: { exerciseId?: unknown; sets?: unknown; reps?: unknown }) => ({
      exerciseId: String(e.exerciseId ?? ''),
      sets: Number.isFinite(Number(e.sets)) ? Math.max(1, Math.round(Number(e.sets))) : 3,
      reps: Number.isFinite(Number(e.reps)) ? Math.max(1, Math.round(Number(e.reps))) : 10,
    }))
    .filter((e: { exerciseId: string; sets: number; reps: number }) => e.exerciseId)

  const row = await prisma.workoutRoutine.create({
    data: { userId: user.id, name: name.slice(0, 120), exercises: JSON.stringify(exercises) },
  })
  return NextResponse.json({ routine: serialize(row) })
}
