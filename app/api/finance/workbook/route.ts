import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WORKBOOK_PATH } from '@/lib/excel'
import { existsSync } from 'fs'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  try {
    const wb = await prisma.financeWorkbook.findUnique({ where: { userId } })
    const rules = await prisma.financeCategorizationRule.count({ where: { userId } })
    const pendingImport = await prisma.financeImport.findFirst({
      where: { userId, status: 'pending_review' },
      orderBy: { createdAt: 'desc' },
    })
    const latestReport = await prisma.financeReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const pastImports = await prisma.financeImport.findMany({
      where: { userId, status: { in: ['approved', 'written'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { _count: { select: { transactions: true } } },
    })

    // For cloud workbooks (blob URL), skip local file check
    const isCloudWorkbook = wb?.blobUrl || wb?.filePath?.startsWith('http')
    const fileExists = wb ? (isCloudWorkbook ? true : existsSync(wb.filePath)) : false

    return NextResponse.json({
      connected: !!wb && fileExists,
      workbook: wb,
      fileExists,
      ruleCount: rules,
      pendingImport,
      latestReport,
      pastImports,
    })
  } catch (e) {
    console.error('[GET /api/finance/workbook]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { userId?: string; blobUrl?: string }
    const { userId, blobUrl } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Cloud blob connection (after client-side upload)
    if (blobUrl) {
      const wb = await prisma.financeWorkbook.upsert({
        where: { userId },
        create: {
          userId,
          filePath: blobUrl,
          fileName: 'Finance Tracker.xlsx',
          blobUrl,
        },
        update: {
          blobUrl,
          filePath: blobUrl,
          fileName: 'Finance Tracker.xlsx',
        },
      })
      return NextResponse.json({ ...wb, fileExists: true })
    }

    // Local file connection
    const resolvedPath = WORKBOOK_PATH
    if (!existsSync(resolvedPath)) {
      return NextResponse.json({
        error: `Excel file not found at: ${resolvedPath}. Place your Finance Tracker .xlsx file at this path, or set the FINANCE_EXCEL_PATH environment variable.`,
        hint: 'Copy your Excel file to the data/ folder in the project root, or set FINANCE_EXCEL_PATH in your environment.',
      }, { status: 400 })
    }

    const wb = await prisma.financeWorkbook.upsert({
      where: { userId },
      create: {
        userId,
        filePath: resolvedPath,
        fileName: resolvedPath.split('/').pop() || 'finance-tracker.xlsx',
      },
      update: {
        filePath: resolvedPath,
        fileName: resolvedPath.split('/').pop() || 'finance-tracker.xlsx',
      },
    })
    return NextResponse.json({ ...wb, fileExists: true })
  } catch (e) {
    console.error('[POST /api/finance/workbook]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
