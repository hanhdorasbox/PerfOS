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
  help?: string
}

const growthYear = (year: number): FieldDef => ({
  key: `fcfGrowthY${year}`,
  label: `FCF growth — year ${year}`,
  format: 'percent',
  group: 'dcf',
  // Spec: default for the explicit years is the 3y revenue CAGR from the API
  fetch: (f) => f.revenueGrowth3y,
  source: 'finnhub',
})

export const FIELD_DEFS: FieldDef[] = [
  {
    key: 'fcfBase',
    label: 'Base FCF (year 0)',
    format: 'money',
    group: 'dcf',
    fetch: (f) => f.fcf,
    source: 'finnhub',
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
  },
  {
    key: 'discountRate',
    label: 'Discount rate (WACC)',
    format: 'percent',
    group: 'dcf',
    help: 'Enter manually, or use the rf + beta × ERP helper',
  },
  {
    key: 'netDebt',
    label: 'Net debt (debt − cash)',
    format: 'money',
    group: 'dcf',
    fetch: (f) => (f.totalDebt !== null && f.cash !== null ? f.totalDebt - f.cash : null),
    source: 'computed',
  },
  {
    key: 'sharesOutstanding',
    label: 'Shares outstanding',
    format: 'number',
    group: 'dcf',
    fetch: (f) => f.sharesOutstanding,
    source: 'finnhub',
  },
  {
    key: 'riskFreeRate',
    label: 'Risk-free rate',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.04,
  },
  {
    key: 'beta',
    label: 'Beta',
    format: 'number',
    group: 'wacc',
    fetch: (f) => f.beta,
    source: 'finnhub',
  },
  {
    key: 'equityRiskPremium',
    label: 'Equity risk premium',
    format: 'percent',
    group: 'wacc',
    defaultValue: 0.05,
  },
  {
    key: 'eps',
    label: 'EPS (TTM)',
    format: 'money',
    group: 'relative',
    fetch: (f) => f.eps,
    source: 'finnhub',
  },
  {
    key: 'peBenchmark',
    label: 'Sector P/E benchmark',
    format: 'number',
    group: 'relative',
    help: 'Note where the number comes from',
  },
  {
    key: 'ebitda',
    label: 'EBITDA (TTM)',
    format: 'money',
    group: 'relative',
    fetch: (f) => f.ebitda,
    source: 'finnhub',
  },
  {
    key: 'evEbitdaBenchmark',
    label: 'Sector EV/EBITDA benchmark',
    format: 'number',
    group: 'relative',
    help: 'Note where the number comes from',
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
