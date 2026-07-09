import { describe, expect, it } from 'vitest'
import { parseCnbDailyRates } from './cnb'

const SAMPLE = `09.07.2026 #131
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|13,554
EMU|euro|1|EUR|24,325
Japonsko|jen|100|JPY|14,720
USA|dolar|1|USD|20,754
`

describe('parseCnbDailyRates', () => {
  it('parses the fixing date to ISO', () => {
    expect(parseCnbDailyRates(SAMPLE).date).toBe('2026-07-09')
  })

  it('converts comma decimals and divides by the quoted amount', () => {
    const { rates } = parseCnbDailyRates(SAMPLE)
    expect(rates.USD).toBe(20.754)
    expect(rates.EUR).toBe(24.325)
    expect(rates.JPY).toBeCloseTo(0.1472, 10) // quoted per 100
  })

  it('throws on an unexpected header', () => {
    expect(() => parseCnbDailyRates('garbage')).toThrow()
  })
})
