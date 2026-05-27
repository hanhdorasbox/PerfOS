import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/** Ensure FitnessScheduleChange table exists (idempotent). */
async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FitnessScheduleChange" (
        "id"              TEXT    NOT NULL,
        "userId"          TEXT    NOT NULL,
        "weekId"          TEXT    NOT NULL,
        "sessionLabel"    TEXT    NOT NULL,
        "sessionDay"      TEXT    NOT NULL,
        "sessionType"     TEXT    NOT NULL DEFAULT 'strength',
        "action"          TEXT    NOT NULL,
        "reason"          TEXT,
        "replacementText" TEXT,
        "affectsAdherence" BOOLEAN NOT NULL DEFAULT true,
        "undone"          BOOLEAN NOT NULL DEFAULT false,
        "notes"           TEXT,
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        CONSTRAINT "FitnessScheduleChange_pkey" PRIMARY KEY ("id")
      )
    `)
  } catch { /* already exists */ }
}

// GET — fetch this week's changes for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const weekId = searchParams.get('weekId')
  if (!userId || !weekId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  await ensureTable()
  const changes = await prisma.fitnessScheduleChange.findMany({
    where: { userId, weekId, undone: false },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(changes)
}

// POST — log a new schedule change
export async function POST(req: NextRequest) {
  await ensureTable()
  const body = await req.json()
  const { userId, weekId, sessionLabel, sessionDay, sessionType, action, reason, replacementText, notes } = body

  if (!userId || !sessionLabel || !sessionDay || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const affectsAdherence = !['rescheduled', 'moving_day'].includes(reason ?? '')

  const change = await prisma.fitnessScheduleChange.create({
    data: {
      userId,
      weekId: weekId ?? new Date().toISOString().split('T')[0],
      sessionLabel,
      sessionDay,
      sessionType: sessionType ?? 'strength',
      action,
      reason: reason ?? null,
      replacementText: replacementText ?? null,
      affectsAdherence,
      notes: notes ?? null,
    },
  })
  return NextResponse.json(change)
}

// PATCH — undo a change (mark undone: true)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await ensureTable()
  const change = await prisma.fitnessScheduleChange.update({
    where: { id },
    data: { undone: true },
  })
  return NextResponse.json(change)
}
