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

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type ManualPriceInput = z.infer<typeof manualPriceSchema>
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>
export type CashUpsertInput = z.infer<typeof cashUpsertSchema>
