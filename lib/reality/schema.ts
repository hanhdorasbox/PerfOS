import { z } from 'zod'
import type { PropertyInputs } from './calc'

// Validace vstupů z klienta. Čísla musí být konečná a nezáporná (kromě těch,
// kde to nedává smysl jinak). Slouží jako ochrana API i jako runtime kontrola.
const nonNeg = z.number().finite().min(0)

export const propertyInputsSchema = z.object({
  purchasePrice: z.number().finite().positive(),
  acquisitionCosts: nonNeg,
  renovationCosts: nonNeg,

  financing: z.enum(['cash', 'mortgage']),
  downPaymentPct: z.number().finite().min(0).max(100),
  interestRate: z.number().finite().min(0).max(100),
  loanTermYears: z.number().finite().min(1).max(50),

  monthlyRent: nonNeg,
  otherMonthlyIncome: nonNeg,
  vacancyPct: z.number().finite().min(0).max(100),

  hoaMonthly: nonNeg,
  propertyTaxYearly: nonNeg,
  insuranceYearly: nonNeg,
  managementPct: z.number().finite().min(0).max(100),
  maintenancePct: z.number().finite().min(0).max(100),

  appreciationPct: z.number().finite().min(-50).max(100),
  rentGrowthPct: z.number().finite().min(-50).max(100),
  incomeTaxPct: z.number().finite().min(0).max(100),
  horizonYears: z.number().finite().int().min(1).max(40),
}) satisfies z.ZodType<PropertyInputs>

export const savePayloadSchema = z.object({
  title: z.string().trim().min(1, 'Zadej název').max(120),
  address: z.string().trim().max(200).optional().nullable(),
  inputs: propertyInputsSchema,
})

export type SavePayload = z.infer<typeof savePayloadSchema>
