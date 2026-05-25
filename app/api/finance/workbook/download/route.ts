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
        const token = process.env.BLOB_READ_WRITE_TOKEN
        if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not set')

        // Use SDK get() — sets Authorization: Bearer TOKEN for private blobs
        const { get } = await import('@vercel/blob')
        const result = await get(wb.blobUrl, { access: 'private', token, useCache: false })
        if (!result || result.statusCode !== 200 || !result.stream) {
          throw new Error(`Blob download failed (HTTP ${result?.statusCode})`)
        }

        // Stream → Buffer
        const reader = result.stream.getReader()
        const chunks: Uint8Array[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
        const buffer = Buffer.concat(chunks)

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
