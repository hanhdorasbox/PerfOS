import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { calculateInvestment } from '@/lib/reality/calc'
import { savePayloadSchema } from '@/lib/reality/schema'

// GET /api/reality — seznam uložených analýz (nejnovější první).
export async function GET() {
  try {
    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

    const analyses = await prisma.propertyAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(analyses)
  } catch (e) {
    console.error('[reality GET]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST /api/reality — vytvoří novou analýzu.
export async function POST(req: NextRequest) {
  try {
    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

    const parsed = savePayloadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Neplatná data' }, { status: 400 })
    }
    const { title, address, inputs } = parsed.data
    const result = calculateInvestment(inputs)

    const created = await prisma.propertyAnalysis.create({
      data: {
        userId: user.id,
        title,
        address: address || null,
        inputs,
        purchasePrice: inputs.purchasePrice,
        financing: inputs.financing,
        monthlyCashFlow: result.monthlyPreTaxCashFlow,
        netYield: result.netYield,
        cashOnCash: result.cashOnCash,
        verdictRating: result.verdict.rating,
      },
    })
    return NextResponse.json(created)
  } catch (e) {
    console.error('[reality POST]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
