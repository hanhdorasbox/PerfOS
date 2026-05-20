import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, type, impact, reusability, monetizable, isPublic } = body
  const pow = await prisma.proofOfWork.create({
    data: {
      userId,
      title,
      type,
      impact: impact || null,
      reusability: Number(reusability),
      monetizable: Boolean(monetizable),
      isPublic: Boolean(isPublic),
    },
  })
  return NextResponse.json(pow)
}
