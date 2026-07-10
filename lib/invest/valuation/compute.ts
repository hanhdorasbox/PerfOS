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
  type SensitivityCell,
} from './dcf'
import { effectiveValue } from './fields'

export interface InputLike {
  field: string
  fetchedValue: string | null
  manualValue: string | null
}

export interface ComputedValuation {
  /** null when required inputs are missing/invalid; see `problems` */
  fairValue: string | null
  marginOfSafety: string | null
  enterpriseValue: string | null
  equityValue: string | null
  impliedFromPe: string | null
  impliedFromEvEbitda: string | null
  capmRate: string | null
  sensitivity: Array<
    Array<{ discountRate: string; terminalGrowth: string; fairValue: string | null; isBase: boolean }>
  > | null
  problems: Array<{ field: string | null; message: string }>
}

function toDecimal(value: string | null): Decimal | null {
  if (value === null || value === '') return null
  try {
    const d = new Decimal(value)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

/**
 * Computes the full valuation from three-state inputs (manual overrides win)
 * and the current price. Missing inputs produce `problems`, never NaN.
 */
export function computeValuation(
  inputs: InputLike[],
  currentPrice: string | null,
): ComputedValuation {
  const byField = new Map(inputs.map((i) => [i.field, i]))
  const val = (key: string): Decimal | null => {
    const input = byField.get(key)
    return input ? toDecimal(effectiveValue(input)) : null
  }

  const problems: ComputedValuation['problems'] = []

  // CAPM helper is informative — computed whenever its pieces exist
  const rf = val('riskFreeRate')
  const beta = val('beta')
  const erp = val('equityRiskPremium')
  const capmRate = rf && beta && erp ? capmDiscountRate(rf, beta, erp) : null

  // ── DCF ────────────────────────────────────────────────────────────────
  const required: Record<string, Decimal | null> = {
    fcfBase: val('fcfBase'),
    terminalGrowth: val('terminalGrowth'),
    discountRate: val('discountRate'),
    netDebt: val('netDebt'),
    sharesOutstanding: val('sharesOutstanding'),
  }
  const growth = [1, 2, 3, 4, 5].map((y) => val(`fcfGrowthY${y}`))

  for (const [field, value] of Object.entries(required)) {
    if (value === null) problems.push({ field, message: 'Chybí hodnota' })
  }
  growth.forEach((g, i) => {
    if (g === null) problems.push({ field: `fcfGrowthY${i + 1}`, message: 'Chybí hodnota' })
  })

  let dcf: ReturnType<typeof dcfFairValue> | null = null
  let sensitivity: SensitivityCell[][] | null = null
  if (problems.length === 0) {
    const dcfInputs: DcfInputs = {
      fcfBase: required.fcfBase!,
      growthRates: growth as [Decimal, Decimal, Decimal, Decimal, Decimal],
      terminalGrowth: required.terminalGrowth!,
      discountRate: required.discountRate!,
      netDebt: required.netDebt!,
      sharesOutstanding: required.sharesOutstanding!,
    }
    try {
      dcf = dcfFairValue(dcfInputs)
      sensitivity = sensitivityTable(dcfInputs)
    } catch (e) {
      if (e instanceof ValuationError) {
        problems.push({ field: e.field ?? null, message: e.message })
      } else {
        throw e
      }
    }
  }

  // ── Relative valuation (independent of DCF completeness) ──────────────
  const eps = val('eps')
  const peBenchmark = val('peBenchmark')
  const impliedFromPe = eps && peBenchmark ? impliedValueFromPe(peBenchmark, eps) : null

  const ebitda = val('ebitda')
  const evBenchmark = val('evEbitdaBenchmark')
  const netDebt = required.netDebt
  const shares = required.sharesOutstanding
  let impliedFromEvEbitda: Decimal | null = null
  if (ebitda && evBenchmark && netDebt !== null && shares && shares.gt(0)) {
    impliedFromEvEbitda = impliedValueFromEvEbitda(evBenchmark, ebitda, netDebt, shares)
  }

  const price = toDecimal(currentPrice)
  const mos = dcf && price ? marginOfSafety(dcf.fairValuePerShare, price) : null

  return {
    fairValue: dcf?.fairValuePerShare.toFixed(4) ?? null,
    marginOfSafety: mos?.toFixed(4) ?? null,
    enterpriseValue: dcf?.enterpriseValue.toFixed(2) ?? null,
    equityValue: dcf?.equityValue.toFixed(2) ?? null,
    impliedFromPe: impliedFromPe?.toFixed(4) ?? null,
    impliedFromEvEbitda: impliedFromEvEbitda?.toFixed(4) ?? null,
    capmRate: capmRate?.toFixed(6) ?? null,
    sensitivity:
      sensitivity?.map((row) =>
        row.map((cell) => ({
          discountRate: cell.discountRate.toFixed(4),
          terminalGrowth: cell.terminalGrowth.toFixed(4),
          fairValue: cell.fairValue?.toFixed(4) ?? null,
          isBase: cell.isBase,
        })),
      ) ?? null,
    problems,
  }
}
