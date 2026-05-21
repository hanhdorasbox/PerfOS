import { NextRequest, NextResponse } from 'next/server'
import { WORKBOOK_PATH } from '@/lib/excel'
import { prisma } from '@/lib/db'
import { readFileSync, existsSync } from 'fs'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    // If userId provided, check for blob URL in DB
    if (userId) {
      const wb = await prisma.financeWorkbook.findUnique({ where: { userId } })
      if (wb?.blobUrl) {
        const res = await fetch(wb.blobUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error('Blob download failed')
        const buffer = await res.arrayBuffer()
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="Finance Tracker.xlsx"',
          },
        })
      }
    }

    // Fallback: local file
    if (!existsSync(WORKBOOK_PATH)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const buffer = readFileSync(WORKBOOK_PATH)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Finance Tracker.xlsx"',
      },
    })
  } catch (e) {
    console.error('[GET /api/finance/workbook/download]', e)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
