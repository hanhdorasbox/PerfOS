import { describe, it, expect } from 'vitest'
import { calculateInvestment, monthlyPayment, irr, type PropertyInputs } from './calc'

const base: PropertyInputs = {
  purchasePrice: 5_000_000,
  acquisitionCosts: 200_000,
  renovationCosts: 0,
  financing: 'mortgage',
  downPaymentPct: 20,
  interestRate: 5,
  loanTermYears: 30,
  monthlyRent: 18_000,
  otherMonthlyIncome: 0,
  vacancyPct: 5,
  hoaMonthly: 3_500,
  propertyTaxYearly: 1_200,
  insuranceYearly: 3_000,
  managementPct: 0,
  maintenancePct: 5,
  appreciationPct: 3,
  rentGrowthPct: 2,
  incomeTaxPct: 15,
  horizonYears: 10,
}

describe('monthlyPayment', () => {
  it('spočítá anuitu (4M Kč, 5 %, 30 let ≈ 21 470 Kč)', () => {
    const p = monthlyPayment(4_000_000, 5, 30)
    expect(p).toBeGreaterThan(21_000)
    expect(p).toBeLessThan(21_800)
  })

  it('při nulovém úroku je splátka jen jistina / počet měsíců', () => {
    expect(monthlyPayment(1_200_000, 0, 10)).toBeCloseTo(10_000, 5)
  })

  it('nulový úvěr → nulová splátka', () => {
    expect(monthlyPayment(0, 5, 30)).toBe(0)
  })
})

describe('irr', () => {
  it('vrátí očekávanou míru pro jednoduchý tok', () => {
    // -100 dnes, +110 za rok → 10 %
    expect(irr([-100, 110])).toBeCloseTo(0.1, 4)
  })

  it('vrátí 0 pro tok bez znaménkové změny', () => {
    expect(irr([100, 110])).toBe(0)
  })
})

describe('calculateInvestment — hypotéka', () => {
  const r = calculateInvestment(base)

  it('rozdělí financování správně (akontace 20 %)', () => {
    expect(r.downPayment).toBe(1_000_000)
    expect(r.loanAmount).toBe(4_000_000)
    expect(r.totalCashInvested).toBe(1_200_000) // akontace + vedlejší náklady
    expect(r.ltv).toBeCloseTo(80, 5)
  })

  it('NOI = efektivní nájem − provozní náklady', () => {
    // hrubý roční nájem = 18000*12 = 216000; efektivní = *0.95 = 205200
    expect(r.grossAnnualRent).toBe(216_000)
    expect(r.effectiveAnnualRent).toBeCloseTo(205_200, 2)
    // opex: hoa 42000 + daň 1200 + pojištění 3000 + údržba 5 % z 205200 = 10260 → 56460
    expect(r.annualOperatingExpenses).toBeCloseTo(56_460, 1)
    expect(r.noi).toBeCloseTo(148_740, 1)
  })

  it('DSCR je definované u hypotéky', () => {
    expect(r.dscr).not.toBeNull()
    expect(r.dscr!).toBeGreaterThan(0)
  })

  it('projekce má správnou délku a rostoucí hodnotu nemovitosti', () => {
    expect(r.projection).toHaveLength(10)
    expect(r.projection[9].propertyValue).toBeGreaterThan(r.projection[0].propertyValue)
    // zůstatek úvěru klesá
    expect(r.projection[9].loanBalance).toBeLessThan(r.projection[0].loanBalance)
  })

  it('vrátí verdikt s odůvodněním', () => {
    expect(['good', 'borderline', 'poor']).toContain(r.verdict.rating)
    expect(r.verdict.reasons.length).toBeGreaterThan(0)
  })
})

describe('calculateInvestment — hotovost', () => {
  const r = calculateInvestment({ ...base, financing: 'cash' })

  it('bez úvěru: DSCR je null a splátka nulová', () => {
    expect(r.loanAmount).toBe(0)
    expect(r.dscr).toBeNull()
    expect(r.monthlyMortgage).toBe(0)
    expect(r.annualDebtService).toBe(0)
  })

  it('vložený kapitál = celé pořizovací náklady', () => {
    expect(r.totalCashInvested).toBe(r.totalAcquisitionCost)
    expect(r.totalCashInvested).toBe(5_200_000)
  })

  it('cash flow za hotové je vyšší než s hypotékou (žádné splátky)', () => {
    const mortgage = calculateInvestment(base)
    expect(r.annualPreTaxCashFlow).toBeGreaterThan(mortgage.annualPreTaxCashFlow)
  })
})

describe('break-even nájem', () => {
  it('při break-even nájmu je cash flow ≈ 0', () => {
    const r = calculateInvestment(base)
    const be = calculateInvestment({ ...base, monthlyRent: r.breakEvenRent })
    expect(be.annualPreTaxCashFlow).toBeCloseTo(0, -1) // do ~10 Kč
  })
})
