import type { PropertyInputs } from './calc'

// Rozumné výchozí hodnoty pro český trh — odpovídají menšímu bytu k pronájmu.
export const DEFAULT_INPUTS: PropertyInputs = {
  purchasePrice: 5_000_000,
  acquisitionCosts: 200_000,
  renovationCosts: 0,

  financing: 'mortgage',
  downPaymentPct: 20,
  interestRate: 5.2,
  loanTermYears: 30,

  monthlyRent: 18_000,
  otherMonthlyIncome: 0,
  vacancyPct: 5,

  hoaMonthly: 3_500,
  propertyTaxYearly: 1_200,
  insuranceYearly: 3_000,
  managementPct: 0,
  maintenancePct: 5,

  appreciationPct: 3,
  rentGrowthPct: 2,
  incomeTaxPct: 15,
  horizonYears: 10,
}
