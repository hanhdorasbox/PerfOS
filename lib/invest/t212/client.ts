// Trading212 Public API (beta) — STRICTLY read-only client.
// Order-placing endpoints (POST /equity/orders/*) must never be implemented
// here: the dashboard is monitoring & analytics only (spec §4b).

export interface T212AccountCash {
  free: number | null
  invested: number | null
  total: number | null
  ppl: number | null
  blocked: number | null
}

export interface T212AccountSummary {
  currencyCode: string | null
  id: number | null
}

export interface T212Position {
  ticker: string // T212 format, e.g. AAPL_US_EQ
  quantity: number
  averagePrice: number | null
  currentPrice: number | null
  ppl: number | null
  initialFillDate: string | null
}

export interface T212Order {
  id: number | string
  ticker: string
  filledQuantity: number | null
  fillPrice: number | null
  filledValue: number | null
  status: string | null
  dateModified: string | null
  dateCreated: string | null
  type: string | null
  taxes: Array<{ name?: string; quantity?: number; fillId?: string }> | null
}

export interface T212Dividend {
  reference: string
  ticker: string
  quantity: number | null
  amount: number | null // in account currency
  amountInEuro: number | null
  grossAmountPerShare: number | null
  paidOn: string | null
  type: string | null
}

export interface T212Instrument {
  ticker: string // T212 format
  name: string | null
  shortName: string | null
  isin: string | null
  currencyCode: string | null
  type: string | null
}

export class T212Error extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'T212Error'
  }
}

type JsonRecord = Record<string, unknown>

function num(obj: JsonRecord, key: string): number | null {
  const v = obj[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(obj: JsonRecord, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v !== '' ? v : null
}

const BASE_URLS = {
  live: 'https://live.trading212.com/api/v0',
  demo: 'https://demo.trading212.com/api/v0',
} as const

export class T212Client {
  private baseUrl: string
  private authHeader: string
  /** Locked once a (host, auth-header) combo authenticated successfully. */
  private resolved = false
  /** Remaining (host, header) combos to probe on the first auth failure. */
  private readonly candidates: Array<{ baseUrl: string; authHeader: string }>

  constructor(opts?: { apiKey?: string; apiSecret?: string; env?: string }) {
    const apiKey = opts?.apiKey ?? process.env.T212_API_KEY
    const apiSecret = opts?.apiSecret ?? process.env.T212_API_SECRET
    const env = (opts?.env ?? process.env.T212_ENV) === 'live' ? 'live' : 'demo'

    if (!apiKey) {
      throw new T212Error('T212_API_KEY is not configured')
    }

    // Two common misconfigurations self-heal here: a key bound to the other
    // environment than T212_ENV says, and a filled-in T212_API_SECRET that
    // turns the header into Basic auth even though T212 expects the raw key.
    // On the first auth failure the client probes the remaining
    // (host, header) combos once and locks in whichever works.
    // Both hosts are read-only for this client.
    const headers = [apiKey.trim()]
    if (apiSecret) {
      headers.unshift(`Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`)
    }
    const hosts = env === 'live' ? [BASE_URLS.live, BASE_URLS.demo] : [BASE_URLS.demo, BASE_URLS.live]
    this.candidates = hosts.flatMap((baseUrl) => headers.map((authHeader) => ({ baseUrl, authHeader })))

    const first = this.candidates.shift()!
    this.baseUrl = first.baseUrl
    this.authHeader = first.authHeader
  }

  private async resolveAuth(path: string): Promise<Response | null> {
    for (const candidate of this.candidates) {
      const res = await fetch(`${candidate.baseUrl}${path}`, {
        headers: { Authorization: candidate.authHeader },
        cache: 'no-store',
      })
      if (res.status !== 401 && res.status !== 403) {
        this.baseUrl = candidate.baseUrl
        this.authHeader = candidate.authHeader
        return res
      }
    }
    return null
  }

  /**
   * Rate limits are per-endpoint: on 429 or exhausted x-ratelimit-remaining
   * wait until x-ratelimit-reset instead of blind retries.
   */
  private async request(path: string): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: this.authHeader },
        cache: 'no-store',
      })

      if ((res.status === 401 || res.status === 403) && !this.resolved) {
        this.resolved = true
        const probed = await this.resolveAuth(path)
        if (!probed) {
          throw new T212Error(
            `T212 auth failed (HTTP ${res.status}) on both live and demo — the key is invalid or incomplete`,
            res.status,
          )
        }
        res = probed
      } else if (res.status === 401 || res.status === 403) {
        // Auth already succeeded on another endpoint, so the key is valid —
        // this endpoint's scope is most likely not enabled on the API key.
        throw new T212Error(
          `T212 ${path} returned HTTP ${res.status} — this endpoint's scope is likely not enabled on the API key`,
          res.status,
        )
      }

      if (res.status === 429) {
        const resetHeader = res.headers.get('x-ratelimit-reset')
        const resetMs = resetHeader ? Number(resetHeader) * 1000 - Date.now() : NaN
        const waitMs = Number.isFinite(resetMs) && resetMs > 0 ? Math.min(resetMs, 30_000) : 5_000
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }
      if (!res.ok) {
        throw new T212Error(`T212 HTTP ${res.status} on ${path}`, res.status)
      }

      this.resolved = true
      const remaining = Number(res.headers.get('x-ratelimit-remaining'))
      if (Number.isFinite(remaining) && remaining <= 1) {
        // Be polite before the next call on this endpoint family
        await new Promise((resolve) => setTimeout(resolve, 1_500))
      }
      return res.json()
    }
    throw new T212Error(`T212 rate limit persisted on ${path}`, 429)
  }

  /** List endpoints return { items, nextPagePath } — iterate until null. */
  private async paginated(path: string, maxPages = 100): Promise<JsonRecord[]> {
    const items: JsonRecord[] = []
    let next: string | null = path
    for (let page = 0; next && page < maxPages; page++) {
      const data = (await this.request(next)) as JsonRecord
      if (Array.isArray(data)) {
        items.push(...(data as JsonRecord[]))
        break
      }
      const pageItems = data.items
      if (Array.isArray(pageItems)) items.push(...(pageItems as JsonRecord[]))
      const nextPagePath = data.nextPagePath
      next =
        typeof nextPagePath === 'string' && nextPagePath !== ''
          ? nextPagePath.replace(/^\/api\/v0/, '')
          : null
    }
    return items
  }

  async getAccountSummary(): Promise<T212AccountSummary> {
    const data = (await this.request('/equity/account/info').catch(() =>
      this.request('/equity/account/summary'),
    )) as JsonRecord
    return { currencyCode: str(data, 'currencyCode'), id: num(data, 'id') }
  }

  async getAccountCash(): Promise<T212AccountCash> {
    const data = (await this.request('/equity/account/cash')) as JsonRecord
    return {
      free: num(data, 'free'),
      invested: num(data, 'invested'),
      total: num(data, 'total'),
      ppl: num(data, 'ppl'),
      blocked: num(data, 'blocked'),
    }
  }

  async getPortfolio(): Promise<T212Position[]> {
    const data = (await this.request('/equity/portfolio')) as unknown
    if (!Array.isArray(data)) return []
    return (data as JsonRecord[])
      .filter((p) => typeof p.ticker === 'string')
      .map((p) => ({
        ticker: p.ticker as string,
        quantity: num(p, 'quantity') ?? 0,
        averagePrice: num(p, 'averagePrice'),
        currentPrice: num(p, 'currentPrice'),
        ppl: num(p, 'ppl'),
        initialFillDate: str(p, 'initialFillDate'),
      }))
  }

  async getOrderHistory(): Promise<T212Order[]> {
    const items = await this.paginated('/equity/history/orders?limit=50')
    return items
      .filter((o) => typeof o.ticker === 'string' && o.id !== undefined)
      .map((o) => ({
        id: o.id as number | string,
        ticker: o.ticker as string,
        filledQuantity: num(o, 'filledQuantity'),
        fillPrice: num(o, 'fillPrice'),
        filledValue: num(o, 'filledValue'),
        status: str(o, 'status'),
        dateModified: str(o, 'dateModified'),
        dateCreated: str(o, 'dateCreated'),
        type: str(o, 'type'),
        taxes: Array.isArray(o.taxes) ? (o.taxes as T212Order['taxes']) : null,
      }))
  }

  async getDividends(): Promise<T212Dividend[]> {
    const items = await this.paginated('/equity/history/dividends?limit=50')
    return items
      .filter((d) => typeof d.ticker === 'string' && typeof d.reference === 'string')
      .map((d) => ({
        reference: d.reference as string,
        ticker: d.ticker as string,
        quantity: num(d, 'quantity'),
        amount: num(d, 'amount'),
        amountInEuro: num(d, 'amountInEuro'),
        grossAmountPerShare: num(d, 'grossAmountPerShare'),
        paidOn: str(d, 'paidOn'),
        type: str(d, 'type'),
      }))
  }

  async getInstruments(): Promise<T212Instrument[]> {
    const data = (await this.request('/equity/metadata/instruments')) as unknown
    if (!Array.isArray(data)) return []
    return (data as JsonRecord[])
      .filter((i) => typeof i.ticker === 'string')
      .map((i) => ({
        ticker: i.ticker as string,
        name: str(i, 'name'),
        shortName: str(i, 'shortName'),
        isin: str(i, 'isin'),
        currencyCode: str(i, 'currencyCode'),
        type: str(i, 'type'),
      }))
  }
}
