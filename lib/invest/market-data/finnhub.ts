import {
  MarketDataError,
  TickerNotFoundError,
  type FundamentalsData,
  type FundamentalsResult,
  type MarketDataProvider,
  type Quote,
} from './types'
import { Throttle } from './throttle'

const BASE_URL = 'https://finnhub.io/api/v1'

// Free tier allows 60 calls/min; 1.1 s spacing keeps us safely under it
// even when several endpoints are hit for one ticker.
const throttle = new Throttle(1100)

type JsonRecord = Record<string, unknown>

/** First finite numeric value among candidate keys, else null. */
function pickNumber(obj: JsonRecord | undefined, ...keys: string[]): number | null {
  if (!obj) return null
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

export class FinnhubProvider implements MarketDataProvider {
  readonly name = 'finnhub'

  constructor(private readonly apiKey = process.env.FINNHUB_API_KEY) {}

  private async request(path: string, params: Record<string, string>): Promise<JsonRecord> {
    if (!this.apiKey) {
      throw new MarketDataError('FINNHUB_API_KEY is not configured', this.name)
    }
    const search = new URLSearchParams({ ...params, token: this.apiKey })
    const res = await throttle.run(() =>
      fetch(`${BASE_URL}${path}?${search}`, { cache: 'no-store' }),
    )
    if (res.status === 429) {
      throw new MarketDataError('Finnhub rate limit exceeded', this.name, params.symbol)
    }
    if (!res.ok) {
      throw new MarketDataError(`Finnhub HTTP ${res.status}`, this.name, params.symbol)
    }
    return (await res.json()) as JsonRecord
  }

  async getQuote(ticker: string): Promise<Quote> {
    const data = await this.request('/quote', { symbol: ticker })
    const price = typeof data.c === 'number' ? data.c : 0
    // Finnhub returns all-zero quotes for unknown symbols instead of a 404
    if (!price) {
      throw new TickerNotFoundError(this.name, ticker)
    }
    return {
      ticker,
      price,
      previousClose: typeof data.pc === 'number' && data.pc !== 0 ? data.pc : null,
      timestamp: typeof data.t === 'number' && data.t !== 0 ? data.t : null,
    }
  }

  async getFundamentals(ticker: string): Promise<FundamentalsResult> {
    // Sequential on purpose — the shared throttle spaces the calls out anyway
    const metricRes = await this.request('/stock/metric', { symbol: ticker, metricType: 'all' })
    const profile = await this.request('/stock/profile2', { symbol: ticker })
    const metric = (metricRes.metric ?? {}) as JsonRecord
    if (Object.keys(metric).length === 0 && Object.keys(profile).length === 0) {
      throw new TickerNotFoundError(this.name, ticker)
    }

    // profile2.shareOutstanding is reported in millions
    const sharesMillions = pickNumber(profile, 'shareOutstanding')
    const sharesOutstanding = sharesMillions !== null ? sharesMillions * 1_000_000 : null

    const perShareToAbsolute = (perShare: number | null): number | null =>
      perShare !== null && sharesOutstanding !== null ? perShare * sharesOutstanding : null

    // Finnhub's free metric endpoint is mostly per-share ratios; absolute
    // figures are derived from per-share × shares outstanding when needed.
    const data: FundamentalsData = {
      revenue:
        pickNumber(metric, 'revenueTTM') ??
        perShareToAbsolute(pickNumber(metric, 'revenuePerShareTTM')),
      ebitda:
        pickNumber(metric, 'ebitdaTTM') ??
        perShareToAbsolute(pickNumber(metric, 'ebitdPerShareTTM', 'ebitdaPerShareTTM')),
      netIncome: pickNumber(metric, 'netIncomeTTM'),
      eps: pickNumber(metric, 'epsTTM', 'epsBasicExclExtraItemsTTM', 'epsInclExtraItemsTTM'),
      fcf:
        pickNumber(metric, 'freeCashFlowTTM') ??
        perShareToAbsolute(pickNumber(metric, 'freeCashFlowPerShareTTM')),
      totalDebt: pickNumber(metric, 'totalDebt'),
      cash: pickNumber(metric, 'cashAndEquivalents', 'totalCash'),
      sharesOutstanding,
      beta: pickNumber(metric, 'beta'),
      peRatio: pickNumber(metric, 'peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM'),
      evEbitda: pickNumber(metric, 'currentEv/ebitdaTTM', 'evEbitdaTTM'),
      revenueGrowth3y: (() => {
        // Finnhub reports growth in percent (e.g. 8.1), we store a fraction
        const pct = pickNumber(metric, 'revenueGrowth3Y')
        return pct !== null ? pct / 100 : null
      })(),
    }

    return { ticker, data, raw: { metric: metricRes, profile } }
  }
}
