import { MarketDataError } from './types'
import { Throttle } from './throttle'

const BASE_URL = 'https://finnhub.io/api/v1'

// Own throttle instance (the one in finnhub.ts is module-private). Finnhub's
// free tier allows 60 calls/min; 1.1 s spacing keeps us safely under it.
const throttle = new Throttle(1100)

export interface NewsArticle {
  /** Finnhub article id as a string, or a url-derived fallback — dedup key */
  externalId: string
  ticker: string
  headline: string
  summary: string
  url: string | null
  source: string | null
  /** Publication time; null when the provider omits it */
  publishedAt: Date | null
}

interface FinnhubNewsItem {
  id?: number
  datetime?: number // unix seconds
  headline?: string
  summary?: string
  source?: string
  url?: string
}

function toDateString(d: Date): string {
  // Finnhub company-news wants YYYY-MM-DD
  return d.toISOString().slice(0, 10)
}

/**
 * Fresh company news for a single ticker over the last `lookbackDays`.
 * Returns newest-first, de-noised of items without a headline. Throws
 * MarketDataError on transport/rate-limit failures so the caller can
 * degrade per-ticker instead of failing the whole run.
 */
export async function fetchCompanyNews(
  ticker: string,
  lookbackDays = 2,
  apiKey = process.env.FINNHUB_API_KEY,
): Promise<NewsArticle[]> {
  if (!apiKey) {
    throw new MarketDataError('FINNHUB_API_KEY is not configured', 'finnhub', ticker)
  }
  const to = new Date()
  const from = new Date(to.getTime() - lookbackDays * 86_400_000)
  const search = new URLSearchParams({
    symbol: ticker,
    from: toDateString(from),
    to: toDateString(to),
    token: apiKey,
  })

  const res = await throttle.run(() =>
    fetch(`${BASE_URL}/company-news?${search}`, { cache: 'no-store' }),
  )
  if (res.status === 429) {
    throw new MarketDataError('Finnhub rate limit exceeded', 'finnhub', ticker)
  }
  if (!res.ok) {
    throw new MarketDataError(`Finnhub company-news HTTP ${res.status}`, 'finnhub', ticker)
  }

  const items = (await res.json()) as FinnhubNewsItem[]
  if (!Array.isArray(items)) return []

  const cutoff = from.getTime()
  return items
    .filter((it) => typeof it.headline === 'string' && it.headline.trim() !== '')
    .map((it) => {
      const publishedAt =
        typeof it.datetime === 'number' && it.datetime > 0 ? new Date(it.datetime * 1000) : null
      const externalId =
        it.id !== undefined && it.id !== null
          ? String(it.id)
          : `url:${(it.url ?? it.headline ?? '').slice(0, 200)}`
      return {
        externalId,
        ticker,
        headline: it.headline!.trim(),
        summary: typeof it.summary === 'string' ? it.summary.trim() : '',
        url: typeof it.url === 'string' && it.url !== '' ? it.url : null,
        source: typeof it.source === 'string' && it.source !== '' ? it.source : null,
        publishedAt,
      }
    })
    // Drop anything older than the lookback window (Finnhub sometimes returns extras)
    .filter((a) => a.publishedAt === null || a.publishedAt.getTime() >= cutoff)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
}
