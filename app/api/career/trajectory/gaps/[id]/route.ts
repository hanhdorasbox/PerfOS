import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if ('closed' in body) {
      data.closed = Boolean(body.closed)
      data.closedAt = body.closed ? new Date() : null
    }
    if ('archived' in body) {
      data.archived = Boolean(body.archived)
      data.archivedAt = body.archived ? new Date() : null
    }
    if ('actionPlan' in body) data.actionPlan = body.actionPlan
    if ('nextBestAction' in body) data.nextBestAction = body.nextBestAction
    if ('evidenceNeeded' in body) data.evidenceNeeded = body.evidenceNeeded
    if ('closureEvidence' in body) data.closureEvidence = body.closureEvidence
    if ('difficulty' in body) data.difficulty = body.difficulty
    if ('weekEstimate' in body) data.weekEstimate = body.weekEstimate
    if ('title' in body) data.title = body.title
    if ('description' in body) data.description = body.description
    if ('priority' in body) data.priority = body.priority

    const gap = await prisma.trajectoryGap.update({ where: { id }, data })
    return NextResponse.json({ gap })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.trajectoryGap.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
