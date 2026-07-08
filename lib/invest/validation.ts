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

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type ManualPriceInput = z.infer<typeof manualPriceSchema>
