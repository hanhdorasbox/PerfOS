// Daily FX rates from the Czech National Bank — official CZK fixing,
// no API key needed. Published every working day around 14:30 Prague time.

const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'

export interface CnbRates {
  /** Fixing date as YYYY-MM-DD */
  date: string
  /** Currency code → CZK per 1 unit (already divided by the quoted amount) */
  rates: Record<string, number>
}

/**
 * Parses the CNB daily fixing. Format:
 *   09.07.2026 #131
 *   země|měna|množství|kód|kurz
 *   USA|dolar|1|USD|20,754
 *   Japonsko|jen|100|JPY|14,720
 */
export function parseCnbDailyRates(text: string): CnbRates {
  const lines = text.trim().split('\n')
  const header = lines[0]?.trim() ?? ''
  const dateMatch = header.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (!dateMatch) {
    throw new Error(`Unexpected CNB header: "${header.slice(0, 40)}"`)
  }
  const [, dd, mm, yyyy] = dateMatch
  const date = `${yyyy}-${mm}-${dd}`

  const rates: Record<string, number> = {}
  for (const line of lines.slice(2)) {
    const parts = line.split('|')
    if (parts.length !== 5) continue
    const amount = Number(parts[2])
    const code = parts[3].trim()
    const rate = Number(parts[4].replace(',', '.'))
    if (!code || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate)) continue
    rates[code] = rate / amount
  }

  if (Object.keys(rates).length === 0) {
    throw new Error('CNB fixing parsed to zero rates')
  }
  return { date, rates }
}

export async function fetchCnbDailyRates(): Promise<CnbRates> {
  const res = await fetch(CNB_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`CNB HTTP ${res.status}`)
  }
  return parseCnbDailyRates(await res.text())
}
