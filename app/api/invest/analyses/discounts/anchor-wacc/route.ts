import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getInvestDb, analyses, analysisInputs, priceSnapshots } from '@/lib/invest/db'
import { computeValuation } from '@/lib/invest/valuation/compute'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Clears the manual discount-rate override on each analysis so the DCF follows
// the computed WACC (for an FCFF model the discount rate IS the WACC). Only
// clears when a WACC/CAPM can actually be derived for that analysis — otherwise
// the manual value is kept so we never break a working DCF that lacks beta.
export async function POST() {
  const db = getInvestDb()
  const rows = await db.select({ id: analyses.id, assetId: analyses.assetId }).from(analyses)

  let recomputed = 0
  let anchored = 0
  let kept = 0

  for (const r of rows) {
    try {
      const inputs = await db
        .select()
        .from(analysisInputs)
        .where(eq(analysisInputs.analysisId, r.id))
      const [latestPrice] = await db
        .select({ price: priceSnapshots.price })
        .from(priceSnapshots)
        .where(eq(priceSnapshots.assetId, r.assetId))
        .orderBy(desc(priceSnapshots.date))
        .limit(1)

      // Would the discount still resolve (via WACC/CAPM) without the override?
      const trial = inputs.map((i) =>
        i.field === 'discountRate' ? { ...i, manualValue: null } : i,
      )
      const canDerive =
        computeValuation(trial, latestPrice?.price ?? null).effectiveDiscountRate !== null

      if (canDerive) {
        await db
          .update(analysisInputs)
          .set({ manualValue: null })
          .where(and(eq(analysisInputs.analysisId, r.id), eq(analysisInputs.field, 'discountRate')))
        anchored += 1
      } else {
        kept += 1
      }

      await recomputeAnalysis(db, r.id, r.assetId)
      recomputed += 1
    } catch {
      // A single un-computable analysis must not stop the rest.
    }
  }

  return NextResponse.json({ total: rows.length, anchored, kept, recomputed })
}
