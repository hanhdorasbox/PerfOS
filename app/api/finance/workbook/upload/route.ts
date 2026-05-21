import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put('finance-tracker.xlsx', buffer, {
      access: 'public',
      addRandomSuffix: false,
    })

    const wb = await prisma.financeWorkbook.upsert({
      where: { userId },
      create: {
        userId,
        filePath: blob.url,
        fileName: file.name,
        blobUrl: blob.url,
      },
      update: {
        blobUrl: blob.url,
        fileName: file.name,
        filePath: blob.url,
      },
    })

    return NextResponse.json({ url: blob.url, workbook: wb })
  } catch (e) {
    console.error('[POST /api/finance/workbook/upload]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
