export interface Quote {
  ticker: string
  /** Current price in the asset currency */
  price: number
  previousClose: number | null
  /** Unix seconds of the quote, if the provider reports it */
  timestamp: number | null
}

/**
 * Fundamentals snapshot as stored in fundamentals_snapshots.data.
 * Every field is nullable — providers rarely have everything, and missing
 * values are exactly what the manual-override layer in analyses is for.
 */
export interface FundamentalsData {
  revenue: number | null
  ebitda: number | null
  netIncome: number | null
  eps: number | null
  fcf: number | null
  totalDebt: number | null
  cash: number | null
  sharesOutstanding: number | null
  beta: number | null
  peRatio: number | null
  evEbitda: number | null
  /** 3-year revenue CAGR as a fraction, e.g. 0.08 = 8 % */
  revenueGrowth3y: number | null
}

export interface FundamentalsResult {
  ticker: string
  data: FundamentalsData
  /** Raw provider payload for debugging/auditing */
  raw: unknown
}

export interface MarketDataProvider {
  readonly name: string
  /** Throws TickerNotFoundError for symbols the provider doesn't know. */
  getQuote(ticker: string): Promise<Quote>
  getFundamentals(ticker: string): Promise<FundamentalsResult>
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly ticker?: string,
  ) {
    super(message)
    this.name = 'MarketDataError'
  }
}

export class TickerNotFoundError extends MarketDataError {
  constructor(provider: string, ticker: string) {
    super(`Provider ${provider} doesn't know ticker ${ticker}`, provider, ticker)
    this.name = 'TickerNotFoundError'
  }
}
