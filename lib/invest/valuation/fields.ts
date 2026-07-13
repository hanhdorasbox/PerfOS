import type { FundamentalsData } from '@/lib/invest/market-data/types'

// Canonical DCF/relative-valuation input fields (analysis_inputs.field keys).
// Three states per field (spec §5a):
//   fetched    — fetched_value set, manual_value null
//   overridden — both set (manual wins)
//   manual     — fetched_value null (the API doesn't supply it)

export type FieldFormat = 'money' | 'percent' | 'number'

export interface FieldDef {
  key: string
  label: string
  format: FieldFormat
  group: 'dcf' | 'wacc' | 'relative'
  /** Extracts the fetched value from a fundamentals snapshot (undefined = manual-only field) */
  fetch?: (f: FundamentalsData) => number | null
  /** 'computed' marks values derived from other fetched numbers (e.g. net debt) */
  source?: 'finnhub' | 'computed' | 'manual'
  /** Seed for manual-only fields on analysis creation */
  defaultValue?: number
  /** Short inline note shown under the input */
  help?: string
  /** Longer plain-language explanation shown in the “?” tooltip */
  hint?: string
}

const growthYear = (year: number): FieldDef => ({
  key: `fcfGrowthY${year}`,
  label: `FCF growth — year ${year}`,
  format: 'percent',
  group: 'dcf',
  // Spec: default for the explicit years is the 3y revenue CAGR from the API
  fetch: (f) => f.revenueGrowth3y,
  source: 'finnhub',
  hint: `How much free cash flow grows in year ${year}. Defaults to the 3-year revenue growth rate. Realistic models fade this down toward the terminal growth — use the “Fade to terminal” button rather than holding one high number for all 5 years.`,
})

export const FIELD_DEFS: FieldDef[] = [
  {
    key: 'fcfBase',
    label: 'Base FCF (year 0)',
    format: 'money',
    group: 'dcf',
    fetch: (f) => f.fcf,
    source: 'finnhub',
    hint: 'The starting free cash flow the whole projection grows from (operating cash flow − capex). One year can be noisy from one-off items — sanity-check it against a 3-year average before trusting the result.',
  },
  growthYear(1),
  growthYear(2),
  growthYear(3),
  growthYear(4),
  growthYear(5),
  {
    key: 'terminalGrowth',
    label: 'Terminal growth',
    format: 'percent',
    group: 'dcf',
    defaultValue: 0.025,
    help: 'Must be lower than the discount rate',
    hint: 'The rate cash flow grows forever after year 5. A company can’t outgrow the economy indefinitely, so keep this at or below long-run nominal GDP (≈ 2–3 %). It must stay well below the discount rate — small changes here move the result a lot.',
  },
  {
    key: 'discountRate',
    label: 'Discount rate (WACC)',
    format: 'percent',
    group: 'dcf',
    help: 'Enter manually, or use the WACC helper below',
    hint: 'The annual rate future cash flows are discounted at — your required return. For an FCFF model this should be the WACC (blend of cost of equity and after-tax cost of debt). Use the WACC helper below to compute it. Higher discount rate → lower fair value.',
  },
  {
    key: 'netDebt',
    label: 'Net debt (debt − cash)',
    format: 'money',
    group: 'dcf',
    fetch: (f) => (f.totalDebt !== null && f.cash !== null ? f.totalDebt - f.cash : null),
    source: 'computed',
    hint: 'Total debt minus cash. Subtracted from enterprise value to get equity value. Negative means net cash (more cash than debt), which adds to the fair value.',
  },
  {
    key: 'sharesOutstanding',
    label: 'Shares outstanding',
    format: 'number',
    group: 'dcf',
    fetch: (f) => f.sharesOutstanding,
    source: 'finnhub',
    hint: 'Equity value is divided by this to get value per share. Use diluted shares (counts options and RSUs) and the most recent figure — buybacks shrink it over time.',
  },
  {
    key: 'riskFreeRate',
    label: 'Risk-free rate',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.04,
    hint: 'The return on a “safe” asset, usually the 10-year government bond yield. It’s the floor of the cost of equity.',
  },
  {
    key: 'beta',
    label: 'Beta',
    format: 'number',
    group: 'wacc',
    fetch: (f) => f.beta,
    source: 'finnhub',
    hint: 'How volatile the stock is vs. the market. Beta 1 = moves with the market, >1 = more volatile (higher required return), <1 = less. Feeds the cost of equity.',
  },
  {
    key: 'equityRiskPremium',
    label: 'Equity risk premium',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.05,
    hint: 'The extra return investors demand for holding stocks over the risk-free asset. Historically ≈ 4.5–5.5 %. Cost of equity = risk-free + beta × this.',
  },
  {
    key: 'costOfDebt',
    label: 'Cost of debt (pre-tax)',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.05,
    hint: 'The interest rate the company pays on its debt. Estimate it as interest expense ÷ total debt, or use the yield on its bonds. Combined with the tax rate and debt weight to get WACC.',
  },
  {
    key: 'taxRate',
    label: 'Tax rate',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.21,
    hint: 'The company’s effective tax rate. Interest on debt is tax-deductible, so debt’s real cost is Rd × (1 − tax). Use the effective rate from the income statement, or the statutory rate (US ≈ 21 %).',
  },
  {
    key: 'totalDebt',
    label: 'Total debt (gross)',
    format: 'money',
    group: 'wacc',
    fetch: (f) => f.totalDebt,
    source: 'finnhub',
    hint: 'Gross debt (not net of cash). Used only to weight debt vs. equity in the WACC. Equity weight is market cap (price × shares); more debt pulls WACC toward the after-tax cost of debt.',
  },
  {
    key: 'eps',
    label: 'EPS (TTM)',
    format: 'money',
    group: 'relative',
    fetch: (f) => f.eps,
    source: 'finnhub',
    hint: 'Earnings per share over the trailing twelve months. Multiplied by the sector P/E to get an implied price — a cross-check on the DCF.',
  },
  {
    key: 'peBenchmark',
    label: 'Sector P/E benchmark',
    format: 'number',
    group: 'relative',
    help: 'Note where the number comes from',
    hint: 'A representative price-to-earnings multiple for the company’s peers/sector. Implied price = this × EPS. Prefer the peer median or a forward multiple over a single guess.',
  },
  {
    key: 'ebitda',
    label: 'EBITDA (TTM)',
    format: 'money',
    group: 'relative',
    fetch: (f) => f.ebitda,
    source: 'finnhub',
    hint: 'Earnings before interest, taxes, depreciation and amortization (trailing twelve months). Used with the EV/EBITDA benchmark for a second relative-valuation cross-check.',
  },
  {
    key: 'evEbitdaBenchmark',
    label: 'Sector EV/EBITDA benchmark',
    format: 'number',
    group: 'relative',
    help: 'Note where the number comes from',
    hint: 'A representative enterprise-value-to-EBITDA multiple for peers. Implied equity value = (this × EBITDA − net debt) ÷ shares. Prefer the peer median or a forward multiple.',
  },
]

export const FIELD_MAP = new Map(FIELD_DEFS.map((d) => [d.key, d]))

export function isKnownField(key: string): boolean {
  return FIELD_MAP.has(key)
}

/** Effective value of a three-state input: manual override wins. */
export function effectiveValue(input: {
  fetchedValue: string | null
  manualValue: string | null
}): string | null {
  return input.manualValue ?? input.fetchedValue
}
