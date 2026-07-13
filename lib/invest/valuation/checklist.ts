// Due-diligence checklist: the qualitative and cross-check factors to weigh
// beyond the DCF fair value before deciding to buy. Stored per analysis as
// { [key]: { status, notes } } in analyses.checklist (jsonb).

export type ChecklistStatus = 'pending' | 'pass' | 'concern' | 'fail'

export interface ChecklistItemDef {
  key: string
  group: string
  label: string
  /** What "good" looks like — shown in the “?” hint and given to the AI. */
  hint: string
}

export interface ChecklistEntry {
  status: ChecklistStatus
  notes: string
}

export type ChecklistState = Record<string, ChecklistEntry>

export const CHECKLIST_STATUSES: ChecklistStatus[] = ['pending', 'pass', 'concern', 'fail']

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  // ── Business & moat ──
  {
    key: 'moat',
    group: 'Business & moat',
    label: 'Durable competitive advantage (moat)?',
    hint: 'Brand, network effects, switching costs, cost/scale advantage, patents. Ask whether it will still be strong in 10 years.',
  },
  {
    key: 'circle',
    group: 'Business & moat',
    label: 'Inside my circle of competence?',
    hint: 'Can I clearly explain how the company makes money and what drives it? If not, skip it.',
  },
  // ── Financial health ──
  {
    key: 'balance_sheet',
    group: 'Financial health',
    label: 'Healthy balance sheet?',
    hint: 'Net debt/EBITDA roughly < 3, comfortable interest coverage, no near-term refinancing cliff.',
  },
  {
    key: 'fcf_quality',
    group: 'Financial health',
    label: 'Consistent free cash flow?',
    hint: 'Reliably FCF-positive through a cycle, and FCF broadly tracks reported earnings (no large accruals gap).',
  },
  // ── Profitability ──
  {
    key: 'margins',
    group: 'Profitability',
    label: 'Stable or improving margins?',
    hint: 'Gross and operating margins steady or rising, not structurally eroding under competition.',
  },
  {
    key: 'returns',
    group: 'Profitability',
    label: 'Returns on capital above cost of capital?',
    hint: 'ROIC/ROE consistently above the WACC means the business creates value as it grows.',
  },
  // ── Growth ──
  {
    key: 'growth',
    group: 'Growth',
    label: 'Durable growth runway?',
    hint: 'Large or expanding addressable market with credible drivers. Are the DCF growth rates actually justified?',
  },
  // ── Management & capital allocation ──
  {
    key: 'management',
    group: 'Management & capital allocation',
    label: 'Trustworthy, aligned management?',
    hint: 'Solid track record, meaningful insider ownership, candid communication, no serial share dilution.',
  },
  {
    key: 'capital_allocation',
    group: 'Management & capital allocation',
    label: 'Sensible capital allocation?',
    hint: 'Buybacks below intrinsic value, a sustainable dividend, disciplined (not empire-building) M&A.',
  },
  // ── Valuation ──
  {
    key: 'mos',
    group: 'Valuation',
    label: 'Margin of safety meets target?',
    hint: 'Current MoS is at or above your target. The larger the discount to fair value, the more room for error.',
  },
  {
    key: 'cross_check',
    group: 'Valuation',
    label: 'Valuation methods agree?',
    hint: 'DCF fair value, P/E-implied and EV/EBITDA-implied values land in a similar range.',
  },
  {
    key: 'assumptions',
    group: 'Valuation',
    label: 'Conservative assumptions?',
    hint: 'Would it still look cheap under a downside case — lower growth and a higher discount rate?',
  },
  // ── Risks ──
  {
    key: 'key_risks',
    group: 'Risks',
    label: 'Key risks identified and tolerable?',
    hint: 'Competition, regulation, disruption, cyclicality, customer/supplier concentration, FX exposure.',
  },
  {
    key: 'red_flags',
    group: 'Risks',
    label: 'No accounting or governance red flags?',
    hint: 'Watch for related-party deals, aggressive revenue recognition, restatements, a weak or captured board.',
  },
  // ── Thesis & fit ──
  {
    key: 'thesis',
    group: 'Thesis & fit',
    label: 'Clear thesis — why is it mispriced?',
    hint: 'One sentence: what does the market miss that you see?',
  },
  {
    key: 'catalysts',
    group: 'Thesis & fit',
    label: 'Catalysts and timeframe?',
    hint: 'What could close the gap to fair value, and roughly when?',
  },
  {
    key: 'position_size',
    group: 'Thesis & fit',
    label: 'Right position size?',
    hint: 'Sized to conviction and risk — a permanent loss here would not sink the portfolio.',
  },
]

export const CHECKLIST_KEYS = new Set(CHECKLIST_ITEMS.map((i) => i.key))

/** Ordered list of the distinct groups, preserving definition order. */
export const CHECKLIST_GROUPS: string[] = [...new Set(CHECKLIST_ITEMS.map((i) => i.group))]

/** Normalises stored/AI data into a full, valid checklist state. */
export function normalizeChecklist(raw: unknown): ChecklistState {
  const out: ChecklistState = {}
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  for (const item of CHECKLIST_ITEMS) {
    const entry = source[item.key]
    const e = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    const status = e.status
    out[item.key] = {
      status: (CHECKLIST_STATUSES as string[]).includes(status as string)
        ? (status as ChecklistStatus)
        : 'pending',
      notes: typeof e.notes === 'string' ? e.notes : '',
    }
  }
  return out
}
