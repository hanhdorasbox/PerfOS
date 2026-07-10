import { asc } from 'drizzle-orm'
import { getInvestDb, assets } from '@/lib/invest/db'
import NewAnalysisForm from '@/components/invest/NewAnalysisForm'

export const dynamic = 'force-dynamic'

export default async function NewAnalysisPage() {
  let assetOptions: Array<{ id: string; ticker: string; currency: string }> = []
  try {
    const db = getInvestDb()
    assetOptions = await db
      .select({ id: assets.id, ticker: assets.ticker, currency: assets.currency })
      .from(assets)
      .orderBy(asc(assets.ticker))
  } catch {
    // form still renders with the "new asset" mode
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="fin-serif" style={{ fontSize: 22, margin: 0 }}>Nová analýza</h2>
      <NewAnalysisForm assets={assetOptions} />
    </div>
  )
}
