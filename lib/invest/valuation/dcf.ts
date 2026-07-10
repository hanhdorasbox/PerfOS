import Decimal from 'decimal.js'

// Pure valuation math (spec §5b) — decimal.js only, no DB, fully unit-tested.

export type Num = string | number | Decimal

function dec(value: Num): Decimal {
  return new Decimal(value)
}

export class ValuationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ValuationError'
  }
}

export interface DcfInputs {
  /** Baseline FCF (year 0), in the asset currency */
  fcfBase: Num
  /** Growth rates for years 1–5 as fractions, e.g. 0.08 */
  growthRates: [Num, Num, Num, Num, Num]
  /** Terminal growth as a fraction; must be < discountRate */
  terminalGrowth: Num
  /** Discount rate (WACC) as a fraction */
  discountRate: Num
  /** totalDebt − cash; negative = net cash */
  netDebt: Num
  sharesOutstanding: Num
}

export interface DcfResult {
  /** Present value of the 5 explicit-year cash flows */
  pvExplicit: Decimal
  /** Present value of the terminal value */
  pvTerminal: Decimal
  enterpriseValue: Decimal
  equityValue: Decimal
  fairValuePerShare: Decimal
  /** Projected FCF per explicit year (undiscounted) */
  projectedFcf: Decimal[]
}

/** FCFF DCF: 5 explicit years + Gordon terminal value. */
export function dcfFairValue(inputs: DcfInputs): DcfResult {
  const fcfBase = dec(inputs.fcfBase)
  const r = dec(inputs.discountRate)
  const g = dec(inputs.terminalGrowth)

  if (r.lte(0)) {
    throw new ValuationError('Diskontní sazba musí být kladná', 'discountRate')
  }
  // Gordon growth breaks down at g >= r — refuse instead of returning NaN
  if (g.gte(r)) {
    throw new ValuationError(
      'Terminal growth musí být nižší než diskontní sazba',
      'terminalGrowth',
    )
  }
  const shares = dec(inputs.sharesOutstanding)
  if (shares.lte(0)) {
    throw new ValuationError('Počet akcií musí být kladný', 'sharesOutstanding')
  }

  const projectedFcf: Decimal[] = []
  let fcf = fcfBase
  for (const growth of inputs.growthRates) {
    fcf = fcf.times(dec(growth).plus(1))
    projectedFcf.push(fcf)
  }

  let pvExplicit = new Decimal(0)
  const onePlusR = r.plus(1)
  projectedFcf.forEach((cashflow, i) => {
    pvExplicit = pvExplicit.plus(cashflow.div(onePlusR.pow(i + 1)))
  })

  const fcfYear5 = projectedFcf[projectedFcf.length - 1]
  const terminalValue = fcfYear5.times(g.plus(1)).div(r.minus(g))
  const pvTerminal = terminalValue.div(onePlusR.pow(projectedFcf.length))

  const enterpriseValue = pvExplicit.plus(pvTerminal)
  const equityValue = enterpriseValue.minus(dec(inputs.netDebt))
  const fairValuePerShare = equityValue.div(shares)

  return { pvExplicit, pvTerminal, enterpriseValue, equityValue, fairValuePerShare, projectedFcf }
}

/** CAPM cost-of-equity helper (spec's WACC pomocník): rf + beta × ERP. */
export function capmDiscountRate(riskFreeRate: Num, beta: Num, equityRiskPremium: Num): Decimal {
  return dec(riskFreeRate).plus(dec(beta).times(dec(equityRiskPremium)))
}

/** MoS = (fairValue − price) / fairValue. Positive = price below fair value. */
export function marginOfSafety(fairValue: Num, price: Num): Decimal | null {
  const fv = dec(fairValue)
  if (fv.lte(0)) return null
  return fv.minus(dec(price)).div(fv)
}

/** Implied share value from a sector P/E benchmark: benchmark × EPS. */
export function impliedValueFromPe(benchmarkPe: Num, eps: Num): Decimal {
  return dec(benchmarkPe).times(dec(eps))
}

/** Implied share value from EV/EBITDA: (benchmark × EBITDA − netDebt) / shares. */
export function impliedValueFromEvEbitda(
  benchmarkMultiple: Num,
  ebitda: Num,
  netDebt: Num,
  sharesOutstanding: Num,
): Decimal {
  const shares = dec(sharesOutstanding)
  if (shares.lte(0)) {
    throw new ValuationError('Počet akcií musí být kladný', 'sharesOutstanding')
  }
  return dec(benchmarkMultiple).times(dec(ebitda)).minus(dec(netDebt)).div(shares)
}

export interface SensitivityCell {
  discountRate: Decimal
  terminalGrowth: Decimal
  /** null where terminal growth >= discount rate (model invalid) */
  fairValue: Decimal | null
  isBase: boolean
}

/**
 * 5×5 matrix (spec §5c): rows = discount rate ±1 p.b. (step 0.5),
 * columns = terminal growth ±1 p.b. (step 0.5).
 */
export function sensitivityTable(inputs: DcfInputs): SensitivityCell[][] {
  const baseR = dec(inputs.discountRate)
  const baseG = dec(inputs.terminalGrowth)
  const offsets = [-0.01, -0.005, 0, 0.005, 0.01]

  return offsets.map((dR) => {
    const r = baseR.plus(dR)
    return offsets.map((dG) => {
      const g = baseG.plus(dG)
      let fairValue: Decimal | null = null
      if (r.gt(0) && g.lt(r)) {
        try {
          fairValue = dcfFairValue({ ...inputs, discountRate: r, terminalGrowth: g }).fairValuePerShare
        } catch {
          fairValue = null
        }
      }
      return { discountRate: r, terminalGrowth: g, fairValue, isBase: dR === 0 && dG === 0 }
    })
  })
}
