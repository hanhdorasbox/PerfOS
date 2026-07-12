import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { calculateInvestment } from '@/lib/reality/calc'
import { savePayloadSchema } from '@/lib/reality/schema'

// GET /api/reality/[id] — jedna analýza.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const analysis = await prisma.propertyAnalysis.findUnique({ where: { id } })
    if (!analysis) return NextResponse.json({ error: 'Analýza nenalezena' }, { status: 404 })
    return NextResponse.json(analysis)
  } catch (e) {
    console.error('[reality GET id]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// PUT /api/reality/[id] — aktualizuje analýzu a přepočítá snapshot.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.propertyAnalysis.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Analýza nenalezena' }, { status: 404 })

    const parsed = savePayloadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Neplatná data' }, { status: 400 })
    }
    const { title, address, inputs } = parsed.data
    const result = calculateInvestment(inputs)

    const updated = await prisma.propertyAnalysis.update({
      where: { id },
      data: {
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
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[reality PUT]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/reality/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.propertyAnalysis.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Analýza nenalezena' }, { status: 404 })
    await prisma.propertyAnalysis.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[reality DELETE]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
