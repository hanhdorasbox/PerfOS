import { describe, expect, it } from 'vitest'
import { computeValuation, type InputLike } from './compute'

function input(field: string, fetched: string | null, manual: string | null = null): InputLike {
  return { field, fetchedValue: fetched, manualValue: manual }
}

const complete: InputLike[] = [
  input('fcfBase', '100'),
  input('fcfGrowthY1', '0.05'),
  input('fcfGrowthY2', '0.05'),
  input('fcfGrowthY3', '0.05'),
  input('fcfGrowthY4', '0.05'),
  input('fcfGrowthY5', '0.05'),
  input('terminalGrowth', null, '0.025'),
  input('discountRate', null, '0.09'),
  input('netDebt', '200'),
  input('sharesOutstanding', '50'),
  input('riskFreeRate', null, '0.04'),
  input('beta', '1.2'),
  input('equityRiskPremium', null, '0.05'),
  input('eps', '6.5'),
  input('peBenchmark', null, '18'),
  input('ebitda', '500'),
  input('evEbitdaBenchmark', null, '10'),
]

describe('computeValuation', () => {
  it('computes DCF, relative values, CAPM and MoS from effective inputs', () => {
    const r = computeValuation(complete, '30')
    expect(r.problems).toHaveLength(0)
    expect(r.fairValue).not.toBeNull()
    expect(Number(r.marginOfSafety)).toBeCloseTo(1 - 30 / Number(r.fairValue), 4)
    expect(Number(r.impliedFromPe)).toBeCloseTo(117, 6)
    expect(Number(r.impliedFromEvEbitda)).toBeCloseTo((10 * 500 - 200) / 50, 6)
    expect(Number(r.capmRate)).toBeCloseTo(0.1, 10)
    expect(r.sensitivity).toHaveLength(5)
  })

  it('manual override wins over fetched', () => {
    const overridden = complete.map((i) =>
      i.field === 'fcfBase' ? input('fcfBase', '100', '200') : i,
    )
    const base = computeValuation(complete, null)
    const doubled = computeValuation(overridden, null)
    // enterpriseValue is rounded to cents, so compare at 1-decimal precision
    expect(Number(doubled.enterpriseValue)).toBeCloseTo(Number(base.enterpriseValue) * 2, 1)
  })

  it('reports missing fields as problems instead of NaN', () => {
    const r = computeValuation(
      complete.filter((i) => i.field !== 'terminalGrowth' && i.field !== 'fcfBase'),
      '30',
    )
    expect(r.fairValue).toBeNull()
    const fields = r.problems.map((p) => p.field)
    expect(fields).toContain('terminalGrowth')
    expect(fields).toContain('fcfBase')
    // relative valuation still works without the DCF pieces
    expect(Number(r.impliedFromPe)).toBeCloseTo(117, 6)
  })

  it('falls back to CAPM as the discount rate when none is entered', () => {
    // No manual discount, and no debt inputs for a full WACC → cost of equity.
    const noDiscount = complete.filter((i) => i.field !== 'discountRate')
    const r = computeValuation(noDiscount, '30')
    expect(r.problems).toHaveLength(0)
    expect(r.discountRateSource).toBe('capm')
    expect(Number(r.effectiveDiscountRate)).toBeCloseTo(0.1, 10) // 0.04 + 1.2×0.05
    expect(r.fairValue).not.toBeNull()
  })

  it('prefers the full WACC over CAPM when the debt inputs are present', () => {
    const withDebt = [
      ...complete.filter((i) => i.field !== 'discountRate'),
      input('costOfDebt', null, '0.05'),
      input('taxRate', null, '0.21'),
      input('totalDebt', '400'),
    ]
    const r = computeValuation(withDebt, '30')
    expect(r.discountRateSource).toBe('wacc')
    expect(Number(r.effectiveDiscountRate)).toBeCloseTo(Number(r.wacc), 10)
  })

  it('blends the available methods and reports their range', () => {
    const r = computeValuation(complete, '30')
    const parts = [r.fairValue, r.impliedFromPe, r.impliedFromEvEbitda].map(Number)
    expect(r.methodCount).toBe(3)
    expect(Number(r.fairValueLow)).toBeCloseTo(Math.min(...parts), 3)
    expect(Number(r.fairValueHigh)).toBeCloseTo(Math.max(...parts), 3)
    expect(Number(r.blendedFairValue)).toBeCloseTo(parts.reduce((a, b) => a + b, 0) / 3, 3)
    expect(Number(r.blendedMarginOfSafety)).toBeCloseTo(1 - 30 / Number(r.blendedFairValue), 4)
  })

  it('surfaces the terminal-growth validation as a problem', () => {
    const bad = complete.map((i) =>
      i.field === 'terminalGrowth' ? input('terminalGrowth', null, '0.09') : i,
    )
    const r = computeValuation(bad, '30')
    expect(r.fairValue).toBeNull()
    expect(r.problems.some((p) => p.field === 'terminalGrowth')).toBe(true)
  })

  it('tolerates garbage strings as missing values', () => {
    const bad = complete.map((i) => (i.field === 'eps' ? input('eps', 'abc') : i))
    const r = computeValuation(bad, '30')
    expect(r.impliedFromPe).toBeNull()
  })
})
