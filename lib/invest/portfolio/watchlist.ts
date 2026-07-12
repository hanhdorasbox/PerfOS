import { desc, eq } from 'drizzle-orm'
import { getInvestDb, analyses, assets, watchlistItems } from '@/lib/invest/db'

export interface WatchlistCandidate {
  ticker: string
  name: string
  targetMos: number
  currentMos: number | null
  /** currentMos − targetMos; positive = target reached */
  distance: number | null
}

/** Watchlist ranked by distance to the target MoS (closest/reached first). */
export async function loadWatchlistRanking(): Promise<WatchlistCandidate[]> {
  const db = getInvestDb()
  const watch = await db
    .select({
      assetId: watchlistItems.assetId,
      targetMos: watchlistItems.targetMos,
      ticker: assets.ticker,
      name: assets.name,
    })
    .from(watchlistItems)
    .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
  if (watch.length === 0) return []

  const active = await db
    .select({ assetId: analyses.assetId, marginOfSafety: analyses.marginOfSafety })
    .from(analyses)
    .where(eq(analyses.status, 'active'))
    .orderBy(desc(analyses.updatedAt))
  const mosByAsset = new Map<string, number>()
  for (const row of active) {
    if (!mosByAsset.has(row.assetId) && row.marginOfSafety !== null) {
      mosByAsset.set(row.assetId, Number(row.marginOfSafety))
    }
  }

  return watch
    .map((w) => {
      const currentMos = mosByAsset.get(w.assetId) ?? null
      const targetMos = Number(w.targetMos)
      return {
        ticker: w.ticker,
        name: w.name,
        targetMos,
        currentMos,
        distance: currentMos !== null ? currentMos - targetMos : null,
      }
    })
    .sort((a, b) => {
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return b.distance - a.distance
    })
}
