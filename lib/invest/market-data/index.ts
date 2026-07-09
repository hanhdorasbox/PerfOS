import { FinnhubProvider } from './finnhub'
import type { MarketDataProvider } from './types'

export * from './types'

const providers: Record<string, () => MarketDataProvider> = {
  finnhub: () => new FinnhubProvider(),
  // Later: alphavantage: () => new AlphaVantageProvider(),
}

/** Provider is chosen via env so a second one can be added without touching callers. */
export function getMarketDataProvider(): MarketDataProvider {
  const name = process.env.MARKET_DATA_PROVIDER ?? 'finnhub'
  const factory = providers[name]
  if (!factory) {
    throw new Error(`Unknown MARKET_DATA_PROVIDER: ${name}`)
  }
  return factory()
}
