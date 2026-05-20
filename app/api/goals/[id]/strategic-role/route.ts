import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { strategicRole } = await req.json()

  const VALID_ROLES = [
    'career_capital',
    'learning',
    'fitness',
    'finance',
    'high_upside_bet',
    'long_term',
  ]

  // Allow clearing the role (null) or setting a valid value
  if (strategicRole !== null && strategicRole !== undefined && !VALID_ROLES.includes(strategicRole)) {
    return NextResponse.json({ error: 'Invalid strategic role' }, { status: 400 })
  }

  const updated = await prisma.goal.update({
    where: { id },
    data: { strategicRole: strategicRole || null, updatedAt: new Date() },
  })

  return NextResponse.json(updated)
}
