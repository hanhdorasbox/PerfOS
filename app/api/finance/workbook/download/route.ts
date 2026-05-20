import { NextResponse } from 'next/server'
import { WORKBOOK_PATH } from '@/lib/excel'
import { readFileSync } from 'fs'

export async function GET() {
  try {
    const buffer = readFileSync(WORKBOOK_PATH)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Finance Tracker.xlsx"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
