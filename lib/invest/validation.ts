import { z } from 'zod'

export const CURRENCIES = ['CZK', 'USD', 'EUR'] as const

export const assetCreateSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'Ticker je povinný')
    .max(20, 'Ticker je příliš dlouhý')
    .regex(/^[A-Za-z0-9.\-^]+$/, 'Ticker smí obsahovat jen písmena, čísla, tečku a pomlčku')
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Název je povinný').max(120),
  currency: z.enum(CURRENCIES, { error: 'Neplatná měna' }),
  exchange: z.string().trim().max(60).optional().nullable(),
  sector: z.string().trim().max(60).optional().nullable(),
  manualPricing: z.boolean().optional().default(false),
})

export const assetUpdateSchema = assetCreateSchema.partial()

export const manualPriceSchema = z.object({
  price: z.coerce.number().positive('Cena musí být kladná'),
  date: z.iso.date('Neplatné datum (YYYY-MM-DD)'),
})

export const transactionCreateSchema = z
  .object({
    assetId: z.uuid(),
    type: z.enum(['buy', 'sell', 'dividend']),
    quantity: z.coerce.number().positive('Počet kusů musí být kladný').optional(),
    price: z.coerce.number().positive('Cena musí být kladná').optional(),
    amount: z.coerce.number().positive('Částka musí být kladná'),
    executedAt: z.iso.date('Neplatné datum (YYYY-MM-DD)'),
    note: z.string().trim().max(300).optional(),
  })
  .refine((tx) => tx.type === 'dividend' || tx.quantity !== undefined, {
    message: 'Počet kusů je u nákupu/prodeje povinný',
    path: ['quantity'],
  })

export const cashUpsertSchema = z.object({
  currency: z.enum(CURRENCIES, { error: 'Neplatná měna' }),
  amount: z.coerce.number().min(0, 'Částka nesmí být záporná'),
})

export const analysisCreateSchema = z.object({
  assetId: z.uuid(),
  title: z.string().trim().min(1, 'Název je povinný').max(140),
})

export const analysisUpdateSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  qualitativeNotes: z.string().max(20000).optional(),
})

export const analysisInputPutSchema = z.object({
  field: z.string().min(1).max(50),
  // null resets the override back to the fetched value
  manualValue: z.union([z.coerce.number(), z.null()]),
  note: z.string().trim().max(300).nullable().optional(),
})

export const watchlistCreateSchema = z.object({
  assetId: z.uuid(),
  targetMos: z.coerce
    .number()
    .min(0, 'Target MoS nesmí být záporný')
    .max(0.95, 'Target MoS je zlomek, např. 0,25'),
  note: z.string().trim().max(300).optional(),
})

export const watchlistUpdateSchema = z.object({
  id: z.uuid(),
  targetMos: z.coerce.number().min(0).max(0.95).optional(),
  note: z.string().trim().max(300).nullable().optional(),
})

export const ALERT_TYPES = [
  'price_vs_fair_value',
  'position_weight',
  'drawdown_from_peak',
  'pe_percentile',
  'cash_below',
  'analysis_stale',
] as const

const alertParamsByType: Record<(typeof ALERT_TYPES)[number], z.ZodTypeAny> = {
  price_vs_fair_value: z.object({
    thresholdPct: z.coerce.number().min(0).max(2).default(0.1),
    assetId: z.uuid().optional(),
  }),
  position_weight: z.object({
    thresholdPct: z.coerce.number().gt(0).max(1),
    assetId: z.uuid().optional(),
  }),
  drawdown_from_peak: z.object({
    thresholdPct: z.coerce.number().gt(0).max(1),
    periodDays: z.coerce.number().int().min(7).max(1825).default(180),
    assetId: z.uuid().optional(),
  }),
  pe_percentile: z.object({
    assetId: z.uuid({ error: 'Vyber asset' }),
    percentile: z.coerce.number().min(0.5).max(0.99).default(0.9),
  }),
  cash_below: z.object({
    thresholdCzk: z.coerce.number().positive(),
  }),
  analysis_stale: z.object({
    months: z.coerce.number().min(1).max(36).default(6),
  }),
}

export const alertRuleCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Název je povinný').max(120),
    type: z.enum(ALERT_TYPES),
    params: z.record(z.string(), z.unknown()).default({}),
    cooldownHours: z.coerce.number().int().min(1).max(24 * 30).default(72),
    isActive: z.boolean().default(true),
  })
  .superRefine((rule, ctx) => {
    const parsed = alertParamsByType[rule.type].safeParse(rule.params)
    if (!parsed.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['params'],
        message: parsed.error.issues[0]?.message ?? 'Neplatné parametry pravidla',
      })
    } else {
      rule.params = parsed.data as Record<string, unknown>
    }
  })

export const alertRuleUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  cooldownHours: z.coerce.number().int().min(1).max(720).optional(),
})

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type ManualPriceInput = z.infer<typeof manualPriceSchema>
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>
export type CashUpsertInput = z.infer<typeof cashUpsertSchema>
