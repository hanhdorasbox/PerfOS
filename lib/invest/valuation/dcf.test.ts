import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  capmDiscountRate,
  dcfFairValue,
  impliedValueFromEvEbitda,
  impliedValueFromPe,
  marginOfSafety,
  sensitivityTable,
  ValuationError,
  type DcfInputs,
} from './dcf'

const baseInputs: DcfInputs = {
  fcfBase: 100,
  growthRates: [0.05, 0.05, 0.05, 0.05, 0.05],
  terminalGrowth: 0.025,
  discountRate: 0.09,
  netDebt: 200,
  sharesOutstanding: 50,
}

describe('dcfFairValue', () => {
  it('computes a zero-growth perpetuity correctly', () => {
    // g = 0 everywhere: PV explicit = 100 × annuity(10%, 5) and TV = 100/0.1
    const r = dcfFairValue({
      fcfBase: 100,
      growthRates: [0, 0, 0, 0, 0],
      terminalGrowth: 0,
      discountRate: 0.1,
      netDebt: 0,
      sharesOutstanding: 1,
    })
    // Full model equals the plain perpetuity 100/0.1 = 1000 when growth is flat
    expect(r.enterpriseValue.toNumber()).toBeCloseTo(1000, 6)
    expect(r.fairValuePerShare.toNumber()).toBeCloseTo(1000, 6)
  })

  it('grows, discounts and nets debt', () => {
    const r = dcfFairValue(baseInputs)
    // year-5 FCF = 100 × 1.05^5
    expect(r.projectedFcf[4].toNumber()).toBeCloseTo(100 * 1.05 ** 5, 6)
    // hand-computed reference value
    const fcf5 = 100 * 1.05 ** 5
    const tv = (fcf5 * 1.025) / (0.09 - 0.025)
    let expected = 0
    for (let t = 1; t <= 5; t++) expected += (100 * 1.05 ** t) / 1.09 ** t
    expected += tv / 1.09 ** 5
    expect(r.enterpriseValue.toNumber()).toBeCloseTo(expected, 4)
    expect(r.equityValue.toNumber()).toBeCloseTo(expected - 200, 4)
    expect(r.fairValuePerShare.toNumber()).toBeCloseTo((expected - 200) / 50, 4)
  })

  it('treats net cash (negative net debt) as added value', () => {
    const withDebt = dcfFairValue(baseInputs)
    const withCash = dcfFairValue({ ...baseInputs, netDebt: -200 })
    expect(withCash.equityValue.minus(withDebt.equityValue).toNumber()).toBeCloseTo(400, 6)
  })

  it('rejects terminal growth >= discount rate instead of returning NaN', () => {
    expect(() => dcfFairValue({ ...baseInputs, terminalGrowth: 0.09 })).toThrow(ValuationError)
    expect(() => dcfFairValue({ ...baseInputs, terminalGrowth: 0.10 })).toThrow(
      /Terminal growth/,
    )
  })

  it('rejects non-positive discount rate and share count', () => {
    expect(() => dcfFairValue({ ...baseInputs, discountRate: 0 })).toThrow(ValuationError)
    expect(() => dcfFairValue({ ...baseInputs, sharesOutstanding: 0 })).toThrow(ValuationError)
  })
})

describe('capmDiscountRate', () => {
  it('is rf + beta × ERP', () => {
    expect(capmDiscountRate(0.04, 1.2, 0.05).toNumber()).toBeCloseTo(0.1, 10)
  })
})

describe('marginOfSafety', () => {
  it('is positive when price is below fair value', () => {
    expect(marginOfSafety(100, 75)?.toNumber()).toBeCloseTo(0.25, 10)
  })
  it('is negative when price exceeds fair value', () => {
    expect(marginOfSafety(100, 120)?.toNumber()).toBeCloseTo(-0.2, 10)
  })
  it('returns null for non-positive fair value', () => {
    expect(marginOfSafety(0, 50)).toBeNull()
    expect(marginOfSafety(-10, 50)).toBeNull()
  })
})

describe('relative valuation', () => {
  it('P/E implied value = benchmark × EPS', () => {
    expect(impliedValueFromPe(18, '6.5').toNumber()).toBeCloseTo(117, 10)
  })
  it('EV/EBITDA implied value nets debt and divides by shares', () => {
    // 10 × 500 − 1000 = 4000 / 100 = 40
    expect(impliedValueFromEvEbitda(10, 500, 1000, 100).toNumber()).toBeCloseTo(40, 10)
  })
})

describe('sensitivityTable', () => {
  it('is 5×5 with the base cell marked', () => {
    const table = sensitivityTable(baseInputs)
    expect(table).toHaveLength(5)
    for (const row of table) expect(row).toHaveLength(5)
    const baseCells = table.flat().filter((c) => c.isBase)
    expect(baseCells).toHaveLength(1)
    expect(baseCells[0].fairValue?.toNumber()).toBeCloseTo(
      dcfFairValue(baseInputs).fairValuePerShare.toNumber(),
      10,
    )
  })

  it('steps by 0.5 p.b. across ±1 p.b.', () => {
    const table = sensitivityTable(baseInputs)
    expect(table[0][0].discountRate.toNumber()).toBeCloseTo(0.08, 10)
    expect(table[4][4].discountRate.toNumber()).toBeCloseTo(0.10, 10)
    expect(table[0][0].terminalGrowth.toNumber()).toBeCloseTo(0.015, 10)
    expect(table[0][4].terminalGrowth.toNumber()).toBeCloseTo(0.035, 10)
  })

  it('marks invalid cells (g >= r) as null instead of NaN', () => {
    const table = sensitivityTable({
      ...baseInputs,
      discountRate: 0.03,
      terminalGrowth: 0.025,
    })
    // top row r = 0.02; columns g up to 0.035 → several invalid cells
    const invalid = table.flat().filter((c) => c.fairValue === null)
    expect(invalid.length).toBeGreaterThan(0)
    for (const cell of invalid) {
      expect(cell.terminalGrowth.gte(cell.discountRate)).toBe(true)
    }
  })

  it('fair value falls as the discount rate rises', () => {
    const table = sensitivityTable(baseInputs)
    const col = 2 // base terminal growth
    const values = table.map((row) => row[col].fairValue!.toNumber())
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1])
  })
})

describe('decimal precision', () => {
  it('keeps exact decimal arithmetic through the pipeline', () => {
    const r = dcfFairValue({
      fcfBase: '0.1',
      growthRates: [0, 0, 0, 0, 0],
      terminalGrowth: 0,
      discountRate: '0.1',
      netDebt: '0',
      sharesOutstanding: '1',
    })
    expect(r.enterpriseValue.minus(new Decimal(1)).abs().lt('1e-20')).toBe(true)
  })
})
