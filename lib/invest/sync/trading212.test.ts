import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { decideHolding, mapToStandardTicker } from './trading212'

const D = (v: string | number) => new Decimal(v)

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

describe('decideHolding', () => {
  it('seeds a snapshot holding when T212 holds shares we cannot reconstruct', () => {
    // The bug this fixes: fractional shares at T212 with no importable order
    // history would otherwise stay invisible and only show as a warning.
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D(0),
      realAvgCost: D(0),
      remote: { quantity: D('0.11466574'), averagePrice: D('123.45') },
    })
    expect(d.action).toBe('seed')
  })

  it('never seeds on top of a real reconstructed holding (no double count)', () => {
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D('10'),
      realAvgCost: D('100'),
      remote: { quantity: D('10'), averagePrice: D('100') },
    })
    expect(d).toEqual({ action: 'reconcile', warning: null })
  })

  it('reconciles and warns on a quantity drift against T212', () => {
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D('10'),
      realAvgCost: D('100'),
      remote: { quantity: D('12'), averagePrice: D('100') },
    })
    expect(d).toEqual({
      action: 'reconcile',
      warning: { ticker: 'FOO', field: 'quantity', local: '10', remote: '12' },
    })
  })

  it('tolerates sub-0.0001 quantity noise', () => {
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D('10'),
      realAvgCost: D('100'),
      remote: { quantity: D('10.00005'), averagePrice: D('100') },
    })
    expect(d).toEqual({ action: 'reconcile', warning: null })
  })

  it('warns on a >1% average-price drift', () => {
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D('10'),
      realAvgCost: D('100'),
      remote: { quantity: D('10'), averagePrice: D('105') },
    })
    expect(d.action).toBe('reconcile')
    expect(d.action === 'reconcile' && d.warning?.field).toBe('averagePrice')
  })

  it('warns when a reconstructed holding is missing at T212', () => {
    const d = decideHolding({
      ticker: 'FOO',
      realQuantity: D('10'),
      realAvgCost: D('100'),
      remote: null,
    })
    expect(d).toEqual({
      action: 'reconcile',
      warning: { ticker: 'FOO', field: 'missing_remote', local: '10', remote: null },
    })
  })

  it('clears when nothing is held locally or at T212', () => {
    expect(decideHolding({ ticker: 'FOO', realQuantity: D(0), realAvgCost: D(0), remote: null })).toEqual({
      action: 'clear',
    })
  })
})
