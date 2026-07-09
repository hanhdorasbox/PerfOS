import { describe, expect, it } from 'vitest'
import { mapToStandardTicker } from './trading212'

describe('mapToStandardTicker', () => {
  it('trusts shortName for US listings', () => {
    const r = mapToStandardTicker('AAPL_US_EQ', {
      ticker: 'AAPL_US_EQ',
      shortName: 'AAPL',
      name: 'Apple',
      isin: null,
      currencyCode: 'USD',
      type: 'STOCK',
    })
    expect(r).toEqual({ ticker: 'AAPL', confident: true })
  })

  it('strips the _US_EQ suffix without metadata', () => {
    expect(mapToStandardTicker('MSFT_US_EQ', undefined)).toEqual({
      ticker: 'MSFT',
      confident: true,
    })
  })

  it('keeps non-US instruments for manual pairing', () => {
    const r = mapToStandardTicker('CEZP_EQ', {
      ticker: 'CEZP_EQ',
      shortName: 'CEZ',
      name: 'ČEZ',
      isin: null,
      currencyCode: 'CZK',
      type: 'STOCK',
    })
    expect(r.ticker).toBe('CEZ')
    expect(r.confident).toBe(false)
  })

  it('falls back to the raw code when nothing is known', () => {
    expect(mapToStandardTicker('WEIRD_EQ', undefined)).toEqual({
      ticker: 'WEIRD_EQ',
      confident: false,
    })
  })
})
