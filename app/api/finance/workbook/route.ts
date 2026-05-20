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

    // Check whether the actual file exists on disk
    const fileExists = wb ? existsSync(wb.filePath) : false

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
    const { userId } = await req.json() as { userId?: string }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Use env var or project-local data/ directory — never a hardcoded user path
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
