// ─── Realitní kalkulačka — výpočetní jádro ────────────────────────────────────
// Čisté, testovatelné funkce bez závislosti na frameworku. Všechny částky jsou
// v Kč, procenta se zadávají jako čísla (5 = 5 %). Model počítá jak nákup za
// hotové, tak s hypotékou (páka), a promítá investici do budoucích let.

export type Financing = 'cash' | 'mortgage'

export interface PropertyInputs {
  // ── Pořízení ──
  purchasePrice: number      // kupní cena
  acquisitionCosts: number   // vedlejší náklady (provize RK, právník, daň, kolky…)
  renovationCosts: number    // rekonstrukce / úpravy před pronájmem

  // ── Financování ──
  financing: Financing
  downPaymentPct: number     // akontace jako % z kupní ceny (jen hypotéka)
  interestRate: number       // úroková sazba % p.a.
  loanTermYears: number      // splatnost úvěru v letech

  // ── Příjmy ──
  monthlyRent: number        // nájemné za měsíc
  otherMonthlyIncome: number // ostatní příjmy/měsíc (parkování, sklep…)
  vacancyPct: number         // předpokládaná neobsazenost v % roku

  // ── Provozní náklady ──
  hoaMonthly: number         // SVJ / fond oprav — Kč/měsíc
  propertyTaxYearly: number  // daň z nemovitých věcí — Kč/rok
  insuranceYearly: number    // pojištění — Kč/rok
  managementPct: number      // správa nemovitosti — % z nájmu
  maintenancePct: number     // údržba / rezerva — % z nájmu

  // ── Předpoklady vývoje ──
  appreciationPct: number    // roční zhodnocení nemovitosti %
  rentGrowthPct: number      // roční růst nájmu a nákladů %
  incomeTaxPct: number       // daň z příjmu z pronájmu % (0 = neuvažovat)
  horizonYears: number       // horizont projekce v letech
}

export interface YearProjection {
  year: number
  propertyValue: number
  grossRent: number
  effectiveRent: number
  operatingExpenses: number
  noi: number                // provozní zisk před splátkou úvěru
  interestPaid: number
  principalPaid: number
  debtService: number        // roční splátky (úrok + jistina)
  incomeTax: number
  preTaxCashFlow: number
  afterTaxCashFlow: number
  loanBalance: number        // zůstatek úvěru na konci roku
  equity: number             // vlastní kapitál = hodnota − zůstatek úvěru
  cumulativeCashFlow: number // kumulovaný cash flow po zdanění
}

export type VerdictRating = 'good' | 'borderline' | 'poor'

export interface Verdict {
  rating: VerdictRating
  label: string
  summary: string
  reasons: string[]
}

export interface InvestmentResult {
  // pořízení
  totalAcquisitionCost: number
  downPayment: number
  loanAmount: number
  totalCashInvested: number
  ltv: number
  // měsíční (rok 1)
  monthlyMortgage: number
  monthlyOperatingExpenses: number
  monthlyPreTaxCashFlow: number
  monthlyAfterTaxCashFlow: number
  // roční (rok 1)
  grossAnnualRent: number
  effectiveAnnualRent: number
  annualOperatingExpenses: number
  noi: number
  annualDebtService: number
  annualPreTaxCashFlow: number
  annualAfterTaxCashFlow: number
  // výnosové ukazatele
  grossYield: number         // hrubý výnos = hrubý nájem / pořizovací náklady
  netYield: number           // čistý výnos (cap rate) = NOI / pořizovací náklady
  cashOnCash: number         // cash-on-cash = roční cash flow / vložený kapitál
  dscr: number | null        // krytí dluhové služby = NOI / splátky (null u hotovosti)
  paybackYears: number | null
  breakEvenRent: number      // nájem, při kterém je cash flow nulový
  // dlouhodobě
  projection: YearProjection[]
  totalReturnPct: number     // celkový výnos za horizont (při prodeji na konci)
  annualizedReturnPct: number // vnitřní výnosové procento (IRR) p.a.
  // verdikt
  verdict: Verdict
}

/** Měsíční anuitní splátka úvěru. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

/**
 * Rozklad splátek za daný rok na úrok a jistinu a zůstatek úvěru na konci roku.
 * Amortizace se počítá po měsících, aby čísla seděla přesně.
 */
function amortizeYear(
  startingBalance: number,
  annualRatePct: number,
  payment: number,
): { interest: number; principal: number; endingBalance: number } {
  const r = annualRatePct / 100 / 12
  let balance = startingBalance
  let interest = 0
  let principal = 0
  for (let m = 0; m < 12 && balance > 0.005; m++) {
    const monthInterest = balance * r
    let monthPrincipal = payment - monthInterest
    if (monthPrincipal > balance) monthPrincipal = balance // poslední splátka
    interest += monthInterest
    principal += monthPrincipal
    balance -= monthPrincipal
  }
  return { interest, principal, endingBalance: Math.max(0, balance) }
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v))

/** Hlavní výpočet — z parametrů nemovitosti spočítá všechny ukazatele a projekci. */
export function calculateInvestment(input: PropertyInputs): InvestmentResult {
  const isMortgage = input.financing === 'mortgage'

  const totalAcquisitionCost =
    input.purchasePrice + input.acquisitionCosts + input.renovationCosts

  const downPayment = isMortgage
    ? input.purchasePrice * clampPct(input.downPaymentPct) / 100
    : input.purchasePrice
  const loanAmount = isMortgage ? Math.max(0, input.purchasePrice - downPayment) : 0

  // Vlastní kapitál, který investor reálně vloží (akontace + vedlejší náklady).
  const totalCashInvested = downPayment + input.acquisitionCosts + input.renovationCosts
  const ltv = input.purchasePrice > 0 ? (loanAmount / input.purchasePrice) * 100 : 0

  const payment = monthlyPayment(loanAmount, input.interestRate, input.loanTermYears)
  const monthlyMortgage = payment
  const annualDebtService = payment * 12

  // ── Rok 1 ──
  const vac = clampPct(input.vacancyPct) / 100
  const monthlyGross = input.monthlyRent + input.otherMonthlyIncome
  const grossAnnualRent = monthlyGross * 12
  const effectiveAnnualRent = grossAnnualRent * (1 - vac)

  const mgmt = effectiveAnnualRent * clampPct(input.managementPct) / 100
  const maint = effectiveAnnualRent * clampPct(input.maintenancePct) / 100
  const annualOperatingExpenses =
    input.hoaMonthly * 12 + input.propertyTaxYearly + input.insuranceYearly + mgmt + maint

  const noi = effectiveAnnualRent - annualOperatingExpenses
  const annualPreTaxCashFlow = noi - annualDebtService

  const grossYield = totalAcquisitionCost > 0 ? (grossAnnualRent / totalAcquisitionCost) * 100 : 0
  const netYield = totalAcquisitionCost > 0 ? (noi / totalAcquisitionCost) * 100 : 0
  const cashOnCash = totalCashInvested > 0 ? (annualPreTaxCashFlow / totalCashInvested) * 100 : 0
  const dscr = isMortgage && annualDebtService > 0 ? noi / annualDebtService : null

  // Nájem (při dané neobsazenosti), při kterém je cash flow přesně nulový.
  const fixedCosts = input.hoaMonthly * 12 + input.propertyTaxYearly + input.insuranceYearly
  const variableRate = (clampPct(input.managementPct) + clampPct(input.maintenancePct)) / 100
  // 0 = R*(1-vac)*(1-variableRate) - fixedCosts - debtService  →  R = (fixed+debt) / ((1-vac)(1-var))
  const denom = (1 - vac) * (1 - variableRate)
  const breakEvenAnnualGross = denom > 0 ? (fixedCosts + annualDebtService) / denom : 0
  const breakEvenRent = Math.max(0, breakEvenAnnualGross / 12 - input.otherMonthlyIncome)

  // ── Projekce do budoucích let ──
  const horizon = Math.max(1, Math.round(input.horizonYears))
  const g = input.rentGrowthPct / 100      // růst nájmu i nákladů
  const a = input.appreciationPct / 100    // zhodnocení nemovitosti
  const taxRate = clampPct(input.incomeTaxPct) / 100

  const projection: YearProjection[] = []
  let balance = loanAmount
  let cumulative = 0
  const irrFlows: number[] = [-totalCashInvested]

  for (let y = 1; y <= horizon; y++) {
    const grow = Math.pow(1 + g, y - 1)
    const grossRent = grossAnnualRent * grow
    const effectiveRent = grossRent * (1 - vac)
    const mgmtY = effectiveRent * clampPct(input.managementPct) / 100
    const maintY = effectiveRent * clampPct(input.maintenancePct) / 100
    const opex =
      (input.hoaMonthly * 12 + input.propertyTaxYearly + input.insuranceYearly) * grow + mgmtY + maintY
    const noiY = effectiveRent - opex

    let interestPaid = 0
    let principalPaid = 0
    if (isMortgage && balance > 0) {
      const am = amortizeYear(balance, input.interestRate, payment)
      interestPaid = am.interest
      principalPaid = am.principal
      balance = am.endingBalance
    }
    const debtService = interestPaid + principalPaid

    // Daňový základ: efektivní nájem − provozní náklady − úroky (jistina daňově neuznatelná).
    const taxable = Math.max(0, effectiveRent - opex - interestPaid)
    const incomeTax = taxable * taxRate

    const preTaxCashFlow = noiY - debtService
    const afterTaxCashFlow = preTaxCashFlow - incomeTax
    cumulative += afterTaxCashFlow

    const propertyValue = input.purchasePrice * Math.pow(1 + a, y)
    const equity = propertyValue - balance

    // Peněžní tok pro IRR: běžný rok = cash flow; v posledním roce přičteme čistý
    // výtěžek z prodeje (hodnota − zůstatek úvěru).
    let flow = afterTaxCashFlow
    if (y === horizon) flow += propertyValue - balance
    irrFlows.push(flow)

    projection.push({
      year: y,
      propertyValue,
      grossRent,
      effectiveRent,
      operatingExpenses: opex,
      noi: noiY,
      interestPaid,
      principalPaid,
      debtService,
      incomeTax,
      preTaxCashFlow,
      afterTaxCashFlow,
      loanBalance: balance,
      equity,
      cumulativeCashFlow: cumulative,
    })
  }

  const last = projection[projection.length - 1]
  const saleProceeds = last.propertyValue - last.loanBalance
  const totalProfit = saleProceeds + cumulative - totalCashInvested
  const totalReturnPct = totalCashInvested > 0 ? (totalProfit / totalCashInvested) * 100 : 0
  const annualizedReturnPct = irr(irrFlows) * 100

  const monthlyOperatingExpenses = annualOperatingExpenses / 12
  const monthlyPreTaxCashFlow = annualPreTaxCashFlow / 12
  const annualAfterTaxCashFlow = projection[0].afterTaxCashFlow
  const monthlyAfterTaxCashFlow = annualAfterTaxCashFlow / 12

  const paybackYears =
    annualAfterTaxCashFlow > 0 ? totalCashInvested / annualAfterTaxCashFlow : null

  const verdict = buildVerdict({
    isMortgage,
    monthlyPreTaxCashFlow,
    cashOnCash,
    netYield,
    grossYield,
    interestRate: input.interestRate,
    dscr,
    annualizedReturnPct,
  })

  return {
    totalAcquisitionCost,
    downPayment,
    loanAmount,
    totalCashInvested,
    ltv,
    monthlyMortgage,
    monthlyOperatingExpenses,
    monthlyPreTaxCashFlow,
    monthlyAfterTaxCashFlow,
    grossAnnualRent,
    effectiveAnnualRent,
    annualOperatingExpenses,
    noi,
    annualDebtService,
    annualPreTaxCashFlow,
    annualAfterTaxCashFlow,
    grossYield,
    netYield,
    cashOnCash,
    dscr,
    paybackYears,
    breakEvenRent,
    projection,
    totalReturnPct,
    annualizedReturnPct,
    verdict,
  }
}

/** Vnitřní výnosové procento (IRR) přes bisekci. Vrací roční míru (0.08 = 8 %). */
export function irr(flows: number[]): number {
  const npv = (rate: number) =>
    flows.reduce((acc, f, i) => acc + f / Math.pow(1 + rate, i), 0)

  // Bez kladného toku nemá IRR smysl.
  if (!flows.some((f) => f > 0) || !flows.some((f) => f < 0)) return 0

  let lo = -0.9999
  let hi = 2 // 200 % p.a. jako horní mez
  let npvLo = npv(lo)
  let npvHi = npv(hi)
  if (npvLo * npvHi > 0) return 0 // kořen mimo rozsah — vrátíme 0 (nevykreslíme)

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const val = npv(mid)
    if (Math.abs(val) < 1e-6) return mid
    if (npvLo * val < 0) {
      hi = mid
      npvHi = val
    } else {
      lo = mid
      npvLo = val
    }
  }
  return (lo + hi) / 2
}

function buildVerdict(m: {
  isMortgage: boolean
  monthlyPreTaxCashFlow: number
  cashOnCash: number
  netYield: number
  grossYield: number
  interestRate: number
  dscr: number | null
  annualizedReturnPct: number
}): Verdict {
  let score = 0
  const reasons: string[] = []

  // Cash flow — je nájem po nákladech a splátce v plusu?
  if (m.monthlyPreTaxCashFlow >= 2000) {
    score += 2
    reasons.push(`Kladný měsíční cash flow ${fmt(m.monthlyPreTaxCashFlow)} Kč — nájem pokrývá náklady i splátku.`)
  } else if (m.monthlyPreTaxCashFlow >= 0) {
    score += 1
    reasons.push(`Cash flow je mírně kladný (${fmt(m.monthlyPreTaxCashFlow)} Kč/měs) — rezerva na výpadky je malá.`)
  } else {
    reasons.push(`Záporný cash flow ${fmt(m.monthlyPreTaxCashFlow)} Kč/měs — každý měsíc musíš doplácet z vlastní kapsy.`)
  }

  // Čistý výnos (cap rate)
  if (m.netYield >= 5) {
    score += 2
    reasons.push(`Čistý výnos ${m.netYield.toFixed(1)} % je nadprůměrný.`)
  } else if (m.netYield >= 3.5) {
    score += 1
    reasons.push(`Čistý výnos ${m.netYield.toFixed(1)} % je průměrný.`)
  } else {
    reasons.push(`Čistý výnos ${m.netYield.toFixed(1)} % je nízký — jsi blízko výnosu spořicích produktů, ale s rizikem nemovitosti.`)
  }

  // Cash-on-cash (návratnost vloženého kapitálu)
  if (m.cashOnCash >= 6) {
    score += 2
    reasons.push(`Cash-on-cash výnos ${m.cashOnCash.toFixed(1)} % — vložený kapitál se dobře zhodnocuje.`)
  } else if (m.cashOnCash >= 3) {
    score += 1
    reasons.push(`Cash-on-cash výnos ${m.cashOnCash.toFixed(1)} % je slušný.`)
  } else if (m.cashOnCash >= 0) {
    reasons.push(`Cash-on-cash výnos jen ${m.cashOnCash.toFixed(1)} % — kapitál pracuje pomalu.`)
  } else {
    reasons.push(`Záporný cash-on-cash výnos (${m.cashOnCash.toFixed(1)} %).`)
  }

  // Páka — vyplácí se úvěr? (kladná páka: čistý výnos > úrok)
  if (m.isMortgage) {
    if (m.netYield > m.interestRate) {
      score += 1
      reasons.push(`Kladná páka: čistý výnos ${m.netYield.toFixed(1)} % převyšuje úrok ${m.interestRate.toFixed(1)} %.`)
    } else {
      reasons.push(`Záporná páka: úrok ${m.interestRate.toFixed(1)} % je vyšší než čistý výnos ${m.netYield.toFixed(1)} % — hypotéka výnos ubírá.`)
    }
    if (m.dscr !== null) {
      if (m.dscr >= 1.25) {
        score += 1
        reasons.push(`Krytí dluhové služby (DSCR) ${m.dscr.toFixed(2)} — banka i ty máte polštář.`)
      } else if (m.dscr < 1) {
        reasons.push(`DSCR ${m.dscr.toFixed(2)} pod 1,0 — provozní zisk nepokryje splátky.`)
      }
    }
  }

  // Celkový výnos p.a. (vč. zhodnocení a umoření jistiny)
  if (m.annualizedReturnPct >= 8) {
    reasons.push(`Odhadovaný celkový výnos ${m.annualizedReturnPct.toFixed(1)} % p.a. (vč. zhodnocení a umoření úvěru) je atraktivní.`)
  } else if (m.annualizedReturnPct > 0) {
    reasons.push(`Odhadovaný celkový výnos ${m.annualizedReturnPct.toFixed(1)} % p.a. včetně zhodnocení.`)
  }

  const maxScore = m.isMortgage ? 10 : 8
  const ratio = score / maxScore

  let rating: VerdictRating
  let label: string
  let summary: string
  if (ratio >= 0.6 && m.monthlyPreTaxCashFlow >= 0) {
    rating = 'good'
    label = 'Vypadá to jako dobrá investice'
    summary = 'Nájem pokrývá náklady a kapitál se rozumně zhodnocuje. Za daných předpokladů dává investice smysl.'
  } else if (ratio >= 0.35) {
    rating = 'borderline'
    label = 'Hraniční — zvaž podmínky'
    summary = 'Čísla nejsou špatná, ale ani přesvědčivá. Citlivé na cenu, úrok a neobsazenost — vyplatí se smlouvat o ceně nebo počkat.'
  } else {
    rating = 'poor'
    label = 'Spíš se nevyplatí'
    summary = 'Za těchto podmínek nemovitost nevydělá dost, aby ospravedlnila vložený kapitál a riziko.'
  }

  return { rating, label, summary, reasons }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('cs-CZ')
}
