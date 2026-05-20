import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, category, proficiency, evidenceNotes, inUse } = body
  const skill = await prisma.skill.create({
    data: {
      userId,
      title,
      category,
      proficiency: Number(proficiency),
      evidenceNotes: evidenceNotes || null,
      inUse: Boolean(inUse),
    },
  })
  return NextResponse.json(skill)
}
