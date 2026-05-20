import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, category, type, title, impact } = body
  const item = await prisma.careerCapitalItem.create({
    data: {
      userId,
      category,
      type,
      title,
      impact: impact || null,
    },
  })
  return NextResponse.json(item)
}
