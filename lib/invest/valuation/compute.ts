import Decimal from 'decimal.js'
import {
  capmDiscountRate,
  dcfFairValue,
  impliedValueFromEvEbitda,
  impliedValueFromPe,
  marginOfSafety,
  sensitivityTable,
  waccDiscountRate,
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
  /** Cost of equity from CAPM (rf + beta × ERP) */
  capmRate: string | null
  /** Full WACC, blending cost of equity and after-tax cost of debt by E/D weights */
  wacc: string | null
  /** The discount rate the DCF actually used (manual override, else WACC, else CAPM) */
  effectiveDiscountRate: string | null
  /** Where the effective discount rate came from */
  discountRateSource: 'manual' | 'wacc' | 'capm' | null
  /** Average of the available method values (DCF, P/E, EV/EBITDA) */
  blendedFairValue: string | null
  /** Lowest / highest of the available method values */
  fairValueLow: string | null
  fairValueHigh: string | null
  /** Dispersion (high − low) ÷ blended — smaller = the methods agree more */
  methodSpread: string | null
  /** How many of the three methods produced a value */
  methodCount: number
  /** Margin of safety against the blended fair value */
  blendedMarginOfSafety: string | null
  sensitivity: Array<
    Array<{ discountRate: string; terminalGrowth: string; fairValue: string | null; isBase: boolean }>
  > | null
  /** Blocking issues — the DCF can't be computed until these are fixed */
  problems: Array<{ field: string | null; message: string }>
  /** Non-blocking sanity warnings (e.g. a likely units/scale mismatch) */
  warnings: string[]
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

  // WACC = E/V·Re + D/V·Rd·(1−tax). Equity value = price × shares (market cap);
  // debt value = gross total debt. Needs the current price to weight properly.
  const costOfDebt = val('costOfDebt')
  const taxRate = val('taxRate')
  const totalDebt = val('totalDebt')
  const sharesForWacc = val('sharesOutstanding')
  const priceForWacc = toDecimal(currentPrice)
  const wacc =
    capmRate && costOfDebt && taxRate !== null && totalDebt !== null && sharesForWacc && priceForWacc
      ? waccDiscountRate(capmRate, costOfDebt, taxRate, priceForWacc.times(sharesForWacc), totalDebt)
      : null

  // ── Discount rate ────────────────────────────────────────────────────────
  // For an FCFF DCF the correct rate IS the WACC, so it's the default: a manual
  // override wins, otherwise the model uses the computed WACC (or CAPM cost of
  // equity when the debt inputs for a full WACC aren't all present). This keeps
  // the discount anchored to the company's real cost of capital instead of a
  // hand-typed guess.
  const manualDiscount = val('discountRate')
  const effectiveDiscount = manualDiscount ?? wacc ?? capmRate
  const discountRateSource: ComputedValuation['discountRateSource'] = manualDiscount
    ? 'manual'
    : wacc
      ? 'wacc'
      : capmRate
        ? 'capm'
        : null

  // ── DCF ────────────────────────────────────────────────────────────────
  const required: Record<string, Decimal | null> = {
    fcfBase: val('fcfBase'),
    terminalGrowth: val('terminalGrowth'),
    discountRate: effectiveDiscount,
    netDebt: val('netDebt'),
    sharesOutstanding: val('sharesOutstanding'),
  }
  const growth = [1, 2, 3, 4, 5].map((y) => val(`fcfGrowthY${y}`))

  for (const [field, value] of Object.entries(required)) {
    if (value === null) problems.push({ field, message: 'Missing value' })
  }
  growth.forEach((g, i) => {
    if (g === null) problems.push({ field: `fcfGrowthY${i + 1}`, message: 'Missing value' })
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
      midYear: true,
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

  // ── Blended fair value ────────────────────────────────────────────────
  // No single method is "right": the DCF is an intrinsic-value estimate, the
  // multiples are relative to the sector. Blend the ones that produced a value
  // (equal weight) and expose the low/high range and how tightly they agree, so
  // the read is a band with a confidence signal rather than one fragile number.
  const methods = [dcf?.fairValuePerShare ?? null, impliedFromPe, impliedFromEvEbitda].filter(
    (m): m is Decimal => m !== null && m.isFinite() && m.gt(0),
  )
  let blended: Decimal | null = null
  let low: Decimal | null = null
  let high: Decimal | null = null
  let methodSpread: Decimal | null = null
  if (methods.length > 0) {
    low = Decimal.min(...methods)
    high = Decimal.max(...methods)
    blended = methods.reduce((sum, m) => sum.plus(m), new Decimal(0)).div(methods.length)
    methodSpread = blended.gt(0) ? high.minus(low).div(blended) : null
  }
  const blendedMos = blended && price ? marginOfSafety(blended, price) : null

  // ── Units/scale sanity check ─────────────────────────────────────────────
  // FCF, net debt and total debt must be in the SAME scale (all absolute, or
  // all in millions). Anchored on market cap (price × shares), flag anything
  // that's off by a suspicious number of orders of magnitude — the classic
  // "typed net debt in billions while FCF is absolute" trap.
  const warnings: string[] = []
  const sharesForScale = required.sharesOutstanding
  const totalDebtVal = val('totalDebt')
  if (price && sharesForScale && sharesForScale.gt(0)) {
    const marketCap = price.times(sharesForScale)
    if (marketCap.gt(0)) {
      // Order of magnitude only — plain floats are plenty here.
      const orders = (x: Decimal) => Math.log10(Math.abs(x.toNumber()))
      const capOrders = orders(marketCap)
      const check = (value: Decimal | null, label: string, lo: number, hi: number) => {
        if (!value || value.isZero()) return
        const diff = capOrders - orders(value)
        if (diff > hi || diff < lo) {
          warnings.push(
            `${label} looks off-scale vs. market cap — check it's in the same units (absolute vs. millions) as FCF.`,
          )
        }
      }
      // FCF is legitimately ~1–2 orders below market cap; net/total debt ~0–1.
      check(required.fcfBase, 'Base FCF', -1, 5)
      check(required.netDebt, 'Net debt', -4, 4)
      check(totalDebtVal, 'Total debt', -4, 4)
    }
  }

  return {
    fairValue: dcf?.fairValuePerShare.toFixed(4) ?? null,
    marginOfSafety: mos?.toFixed(4) ?? null,
    enterpriseValue: dcf?.enterpriseValue.toFixed(2) ?? null,
    equityValue: dcf?.equityValue.toFixed(2) ?? null,
    impliedFromPe: impliedFromPe?.toFixed(4) ?? null,
    impliedFromEvEbitda: impliedFromEvEbitda?.toFixed(4) ?? null,
    capmRate: capmRate?.toFixed(6) ?? null,
    wacc: wacc?.toFixed(6) ?? null,
    effectiveDiscountRate: effectiveDiscount?.toFixed(6) ?? null,
    discountRateSource,
    blendedFairValue: blended?.toFixed(4) ?? null,
    fairValueLow: low?.toFixed(4) ?? null,
    fairValueHigh: high?.toFixed(4) ?? null,
    methodSpread: methodSpread?.toFixed(4) ?? null,
    methodCount: methods.length,
    blendedMarginOfSafety: blendedMos?.toFixed(4) ?? null,
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
    warnings,
  }
}
