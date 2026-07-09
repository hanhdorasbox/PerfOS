import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { computeHolding, computeWeights, toCzk, valuePosition, type TxLike } from './calc'

function tx(partial: Partial<TxLike> & Pick<TxLike, 'type' | 'amount'>): TxLike {
  return {
    quantity: null,
    price: null,
    executedAt: '2026-01-01T12:00:00Z',
    ...partial,
  }
}

describe('computeHolding', () => {
  it('accumulates buys into quantity and cost basis', () => {
    const h = computeHolding([
      tx({ type: 'buy', quantity: '10', price: '100', amount: '1000' }),
      tx({ type: 'buy', quantity: '5', price: '130', amount: '650', executedAt: '2026-02-01' }),
    ])
    expect(h.quantity.toString()).toBe('15')
    expect(h.costBasis.toString()).toBe('1650')
    expect(h.avgCost.toString()).toBe('110')
  })

  it('realizes P/L against average cost on sells', () => {
    const h = computeHolding([
      tx({ type: 'buy', quantity: '10', price: '100', amount: '1000' }),
      tx({ type: 'sell', quantity: '4', price: '150', amount: '600', executedAt: '2026-03-01' }),
    ])
    expect(h.quantity.toString()).toBe('6')
    expect(h.realizedPnl.toString()).toBe('200') // 600 − 4×100
    expect(h.costBasis.toString()).toBe('600')
    expect(h.avgCost.toString()).toBe('100')
  })

  it('processes transactions in execution order regardless of input order', () => {
    const h = computeHolding([
      tx({ type: 'sell', quantity: '5', price: '120', amount: '600', executedAt: '2026-05-01' }),
      tx({ type: 'buy', quantity: '10', price: '100', amount: '1000', executedAt: '2026-01-01' }),
    ])
    expect(h.quantity.toString()).toBe('5')
    expect(h.realizedPnl.toString()).toBe('100')
  })

  it('never goes below zero quantity on oversell', () => {
    const h = computeHolding([
      tx({ type: 'buy', quantity: '2', price: '10', amount: '20' }),
      tx({ type: 'sell', quantity: '5', price: '10', amount: '50', executedAt: '2026-06-01' }),
    ])
    expect(h.quantity.toString()).toBe('0')
    expect(h.costBasis.toString()).toBe('0')
  })

  it('collects dividends and fees separately', () => {
    const h = computeHolding([
      tx({ type: 'buy', quantity: '1', price: '10', amount: '10' }),
      tx({ type: 'dividend', amount: '3.5' }),
      tx({ type: 'fee', amount: '1.2' }),
    ])
    expect(h.dividends.toString()).toBe('3.5')
    expect(h.fees.toString()).toBe('1.2')
    expect(h.quantity.toString()).toBe('1')
  })

  it('handles fractional shares without float drift', () => {
    const h = computeHolding([
      tx({ type: 'buy', quantity: '0.1', price: '0.3', amount: '0.03' }),
      tx({ type: 'buy', quantity: '0.2', price: '0.3', amount: '0.06', executedAt: '2026-02-01' }),
    ])
    expect(h.quantity.toString()).toBe('0.3') // 0.1 + 0.2 === 0.3 exactly
    expect(h.avgCost.toString()).toBe('0.3')
  })
})

describe('valuePosition', () => {
  it('computes market value and unrealized P/L', () => {
    const h = computeHolding([tx({ type: 'buy', quantity: '10', price: '100', amount: '1000' })])
    const v = valuePosition(h, '120')
    expect(v.marketValue.toString()).toBe('1200')
    expect(v.unrealizedPnl.toString()).toBe('200')
    expect(v.unrealizedPnlPct?.toString()).toBe('0.2')
  })

  it('returns null percentage with zero cost basis', () => {
    const h = computeHolding([])
    const v = valuePosition(h, '50')
    expect(v.unrealizedPnlPct).toBeNull()
  })
})

describe('toCzk', () => {
  it('is identity for CZK and multiplies by the rate otherwise', () => {
    expect(toCzk(new Decimal(100), 'CZK', {})?.toString()).toBe('100')
    expect(toCzk(new Decimal(100), 'USD', { USD: '20.75' })?.toString()).toBe('2075')
    expect(toCzk(new Decimal(100), 'GBP', { USD: '20.75' })).toBeNull()
  })
})

describe('computeWeights', () => {
  it('computes fractions of total', () => {
    const weights = computeWeights([
      { id: 'a', valueCzk: new Decimal(750) },
      { id: 'b', valueCzk: new Decimal(250) },
    ])
    expect(weights.get('a')?.toString()).toBe('0.75')
    expect(weights.get('b')?.toString()).toBe('0.25')
  })
})
