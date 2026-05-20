import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  try {
    const { userId, name, email, height } = await req.json() as { userId: string; name?: string; email?: string; height?: number | null }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      data.name = name.trim()
    }
    if (email !== undefined) {
      if (!email.trim()) return NextResponse.json({ error: 'email cannot be empty' }, { status: 400 })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json({ error: 'email is not valid' }, { status: 400 })
      }
      data.email = email.trim()
    }
    if (height !== undefined) {
      if (height !== null && (typeof height !== 'number' || height <= 0 || height > 300)) {
        return NextResponse.json({ error: 'height must be a positive number in cm' }, { status: 400 })
      }
      data.height = height
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const user = await prisma.user.update({ where: { id: userId }, data })
    return NextResponse.json(user)
  } catch (e) {
    console.error('[user PATCH]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
