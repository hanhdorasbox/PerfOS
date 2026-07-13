import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import {
  getInvestDb,
  analyses,
  analysisInputs,
  assets,
  fundamentalsSnapshots,
  priceSnapshots,
  watchlistItems,
} from '@/lib/invest/db'
import AnalysisCalculator, { type CalcInput } from '@/components/invest/AnalysisCalculator'
import { FIELD_DEFS } from '@/lib/invest/valuation/fields'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const db = getInvestDb()

  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1)
  if (!analysis) notFound()

  const [asset] = await db.select().from(assets).where(eq(assets.id, analysis.assetId)).limit(1)
  if (!asset) notFound()

  const inputs = await db
    .select()
    .from(analysisInputs)
    .where(eq(analysisInputs.analysisId, id))

  const [latestPrice] = await db
    .select({ price: priceSnapshots.price })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.assetId, asset.id))
    .orderBy(desc(priceSnapshots.date))
    .limit(1)

  const [watchlist] = await db
    .select({ targetMos: watchlistItems.targetMos })
    .from(watchlistItems)
    .where(eq(watchlistItems.assetId, asset.id))
    .limit(1)

  const [fundamentals] = await db
    .select({ fetchedAt: fundamentalsSnapshots.fetchedAt })
    .from(fundamentalsSnapshots)
    .where(eq(fundamentalsSnapshots.assetId, asset.id))
    .orderBy(desc(fundamentalsSnapshots.fetchedAt))
    .limit(1)

  const inputByField = new Map(inputs.map((i) => [i.field, i]))
  // Backfill any field added to FIELD_DEFS after this analysis was created
  // (e.g. the WACC inputs) so they still render; the inputs PUT upserts them.
  const calcInputs: CalcInput[] = FIELD_DEFS.map((def) => {
    const i = inputByField.get(def.key)
    return i
      ? {
          field: i.field,
          fetchedValue: i.fetchedValue,
          manualValue: i.manualValue,
          note: i.note,
          source: i.source,
          snapshotAt: i.snapshotAt.toISOString(),
        }
      : {
          field: def.key,
          fetchedValue: null,
          manualValue: def.defaultValue !== undefined ? String(def.defaultValue) : null,
          note: null,
          source: 'manual',
          snapshotAt: new Date().toISOString(),
        }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 className="fin-serif" style={{ fontSize: 22, margin: 0 }}>
          <span className="fin-mono">{asset.ticker}</span> — {asset.name}
        </h2>
        <Link href="/invest/analysis" className="fin-subtle" style={{ marginLeft: 'auto', fontSize: 13, textDecoration: 'none' }}>
          ← back to analyses
        </Link>
      </div>
      <AnalysisCalculator
        analysis={{
          id: analysis.id,
          title: analysis.title,
          status: analysis.status,
          qualitativeNotes: analysis.qualitativeNotes,
        }}
        asset={{ ticker: asset.ticker, name: asset.name, currency: asset.currency }}
        initialInputs={calcInputs}
        currentPrice={latestPrice?.price ?? null}
        targetMos={watchlist?.targetMos ?? null}
        fundamentalsFetchedAt={fundamentals?.fetchedAt.toISOString() ?? null}
      />
    </div>
  )
}
