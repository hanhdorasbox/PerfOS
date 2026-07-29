import { eq, inArray } from 'drizzle-orm'
import {
  getInvestDb,
  assets,
  cronRuns,
  newsEvents,
  positions,
  watchlistItems,
  type InvestDb,
} from '@/lib/invest/db'
import { fetchCompanyNews, type NewsArticle } from '@/lib/invest/market-data/news'
import { sendTelegram, telegramConfigured } from '@/lib/invest/telegram/send'
import { createAnthropicClient } from '@/lib/anthropic'

// Cheap classifier — this is triage over headlines, not deep analysis.
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001'

// Only the most recent headlines per ticker reach the LLM, to bound token use.
const MAX_ARTICLES_PER_ASSET = 15
// How far back to pull news. >1 day gives slack if a cron run is missed.
const LOOKBACK_DAYS = 2

const CLASSIFIER_SYSTEM = `Jsi akciový analytik. Dostaneš čerstvé titulky zpráv o JEDNÉ firmě.
Vyber POUZE ty, které jsou zásadní a pravděpodobně znatelně pohnou cenou akcie:
výsledky/guidance a jejich překvapení, fúze a akvizice, velké kontrakty či ztráta
zákazníka, regulace/žaloby/vyšetřování, změna vedení, zásadní produktová nebo
strategická zpráva, výrazné změny doporučení analytiků s odůvodněním.

IGNORUJ rutinu, klikbait, obecné přehledy trhu, spekulace bez faktu, opakování
téže zprávy a marketingové PR bez dopadu na hodnotu.

Vrať POUZE JSON pole (žádný jiný text, žádné markdown bloky):
[{"index": <číslo článku>, "impact": "pozitivní|negativní|nejasný", "reason": "<1 věta česky: co se stalo a proč to hne cenou>"}]
Když nic zásadního není, vrať prázdné pole [].`

export interface NewsRunResult {
  assetsChecked: number
  articlesFetched: number
  newArticles: number
  significant: number
  notified: boolean
  errors: string[]
}

interface TrackedAsset {
  assetId: string
  ticker: string
  name: string
  sources: Set<'holding' | 'watchlist'>
}

interface Verdict {
  impact: string
  reason: string
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Assets to monitor: open holdings + watchlist, minus anything the market-data
 *  provider can't resolve (manual-priced or unmapped tickers like CEZ.PR). */
async function loadTrackedAssets(db: InvestDb): Promise<TrackedAsset[]> {
  const [held, watched] = await Promise.all([
    db.select({ assetId: positions.assetId }).from(positions).where(eq(positions.status, 'open')),
    db.select({ assetId: watchlistItems.assetId }).from(watchlistItems),
  ])

  const source = new Map<string, Set<'holding' | 'watchlist'>>()
  for (const r of held) (source.get(r.assetId) ?? source.set(r.assetId, new Set()).get(r.assetId)!).add('holding')
  for (const r of watched) (source.get(r.assetId) ?? source.set(r.assetId, new Set()).get(r.assetId)!).add('watchlist')

  const ids = [...source.keys()]
  if (ids.length === 0) return []

  const rows = await db
    .select({
      id: assets.id,
      ticker: assets.ticker,
      name: assets.name,
      manualPricing: assets.manualPricing,
      needsMapping: assets.needsMapping,
    })
    .from(assets)
    .where(inArray(assets.id, ids))

  return rows
    .filter((a) => !a.manualPricing && !a.needsMapping)
    .map((a) => ({ assetId: a.id, ticker: a.ticker, name: a.name, sources: source.get(a.id)! }))
}

function extractJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** LLM triage: returns a verdict per article index that is materially significant. */
async function classifyNews(
  client: ReturnType<typeof createAnthropicClient>,
  asset: TrackedAsset,
  articles: NewsArticle[],
): Promise<Map<number, Verdict>> {
  const list = articles
    .map((a, i) => `[${i}] ${a.headline}${a.summary ? ` — ${a.summary.slice(0, 300)}` : ''}`)
    .join('\n')

  const resp = await client.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 1500,
    system: CLASSIFIER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Firma: ${asset.name} (${asset.ticker}).\nČerstvé titulky:\n${list}`,
      },
    ],
  })

  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const parsed = extractJsonArray(text)
  const verdicts = new Map<number, Verdict>()
  if (!parsed) return verdicts
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    const index = typeof rec.index === 'number' ? rec.index : Number(rec.index)
    if (!Number.isInteger(index) || index < 0 || index >= articles.length) continue
    const impact =
      typeof rec.impact === 'string' && ['pozitivní', 'negativní', 'nejasný'].includes(rec.impact)
        ? rec.impact
        : 'nejasný'
    const reason = typeof rec.reason === 'string' ? rec.reason.trim() : ''
    verdicts.set(index, { impact, reason })
  }
  return verdicts
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const IMPACT_EMOJI: Record<string, string> = { negativní: '🔴', pozitivní: '🟢', nejasný: '⚪' }
const IMPACT_ORDER: Record<string, number> = { negativní: 0, pozitivní: 1, nejasný: 2 }

interface SignificantEvent {
  ticker: string
  sources: Set<'holding' | 'watchlist'>
  headline: string
  url: string | null
  source: string | null
  impact: string
  reason: string
}

function buildTelegramMessage(events: SignificantEvent[]): string {
  const now = new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(new Date())

  const header = `🔔 <b>Významné zprávy k tvému portfoliu</b>\n<i>${now}</i>`

  const sorted = [...events].sort(
    (a, b) => (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3) || a.ticker.localeCompare(b.ticker),
  )

  const blocks = sorted.map((e) => {
    const tag = e.sources.has('holding') ? 'držíš' : 'watchlist'
    const emoji = IMPACT_EMOJI[e.impact] ?? '⚪'
    const link = e.url ? `\n<a href="${escapeHtml(e.url)}">${escapeHtml(e.source ?? 'odkaz')}</a>` : ''
    const reason = e.reason ? `\n<i>${escapeHtml(e.reason)}</i>` : ''
    return `${emoji} <b>${escapeHtml(e.ticker)}</b> · ${tag} · ${escapeHtml(e.impact)}\n${escapeHtml(e.headline)}${reason}${link}`
  })

  return [header, ...blocks].join('\n\n')
}

/**
 * News monitoring run: for every tracked asset, pull fresh company news, skip
 * anything already seen (dedup ledger = news_events), let the LLM keep only the
 * materially significant items, persist them, and push a Telegram digest of the
 * new significant ones. Degrades per-asset; always finishes its cron_runs row.
 */
export async function runNewsCron(): Promise<NewsRunResult> {
  const db = getInvestDb()
  const [run] = await db
    .insert(cronRuns)
    .values({ job: 'news', status: 'running' })
    .returning({ id: cronRuns.id })

  const result: NewsRunResult = {
    assetsChecked: 0,
    articlesFetched: 0,
    newArticles: 0,
    significant: 0,
    notified: false,
    errors: [],
  }

  try {
    const tracked = await loadTrackedAssets(db)
    const client = createAnthropicClient()
    const toNotify: SignificantEvent[] = []
    const notifiedIds: string[] = []

    for (const asset of tracked) {
      result.assetsChecked += 1
      try {
        const articles = await fetchCompanyNews(asset.ticker, LOOKBACK_DAYS)
        result.articlesFetched += articles.length
        if (articles.length === 0) continue

        // Dedup: drop articles already recorded for this asset.
        const existing = await db
          .select({ externalId: newsEvents.externalId })
          .from(newsEvents)
          .where(eq(newsEvents.assetId, asset.assetId))
        const seen = new Set(existing.map((e) => e.externalId))
        const fresh = articles.filter((a) => !seen.has(a.externalId)).slice(0, MAX_ARTICLES_PER_ASSET)
        if (fresh.length === 0) continue
        result.newArticles += fresh.length

        const verdicts = await classifyNews(client, asset, fresh)

        // Persist every fresh article (significant or not) so it's never
        // reconsidered; collect the significant ones for notification.
        const rows = fresh.map((a, i) => {
          const v = verdicts.get(i)
          return {
            assetId: asset.assetId,
            ticker: asset.ticker,
            externalId: a.externalId,
            headline: a.headline,
            url: a.url,
            source: a.source,
            summary: a.summary || null,
            publishedAt: a.publishedAt,
            significant: v !== undefined,
            impact: v?.impact ?? null,
            reason: v?.reason ?? null,
            notified: false,
          }
        })

        const inserted = await db
          .insert(newsEvents)
          .values(rows)
          .onConflictDoNothing({ target: [newsEvents.assetId, newsEvents.externalId] })
          .returning({ id: newsEvents.id, externalId: newsEvents.externalId, significant: newsEvents.significant })

        for (const row of inserted) {
          if (!row.significant) continue
          const idx = fresh.findIndex((a) => a.externalId === row.externalId)
          if (idx < 0) continue
          const v = verdicts.get(idx)!
          const a = fresh[idx]
          toNotify.push({
            ticker: asset.ticker,
            sources: asset.sources,
            headline: a.headline,
            url: a.url,
            source: a.source,
            impact: v.impact,
            reason: v.reason,
          })
          notifiedIds.push(row.id)
        }
      } catch (e) {
        result.errors.push(`${asset.ticker}: ${errorMessage(e)}`)
      }
    }

    result.significant = toNotify.length

    if (toNotify.length > 0) {
      if (telegramConfigured()) {
        try {
          const sent = await sendTelegram(buildTelegramMessage(toNotify))
          if (sent) {
            result.notified = true
            await db.update(newsEvents).set({ notified: true }).where(inArray(newsEvents.id, notifiedIds))
          }
        } catch (e) {
          result.errors.push(`telegram: ${errorMessage(e)}`)
        }
      } else {
        result.errors.push('telegram: not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)')
      }
    }

    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: result.errors.length === 0 ? 'success' : 'error',
        error: result.errors.length > 0 ? result.errors.join(' | ').slice(0, 2000) : null,
      })
      .where(eq(cronRuns.id, run.id))

    return result
  } catch (e) {
    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), status: 'error', error: errorMessage(e).slice(0, 2000) })
      .where(eq(cronRuns.id, run.id))
    throw e
  }
}
