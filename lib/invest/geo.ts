// Maps a Finnhub country code (ISO-3166 alpha-2, e.g. "US") to a continent,
// so holdings can be grouped/filtered by region. Unknown codes fall back to
// "Other" rather than guessing.

const CONTINENT_BY_COUNTRY: Record<string, string> = {
  // North America
  US: 'North America', CA: 'North America', MX: 'North America', BM: 'North America',
  // South America
  BR: 'South America', AR: 'South America', CL: 'South America', CO: 'South America', PE: 'South America',
  // Europe
  GB: 'Europe', IE: 'Europe', DE: 'Europe', FR: 'Europe', NL: 'Europe', CH: 'Europe',
  ES: 'Europe', IT: 'Europe', SE: 'Europe', NO: 'Europe', DK: 'Europe', FI: 'Europe',
  BE: 'Europe', AT: 'Europe', PT: 'Europe', PL: 'Europe', CZ: 'Europe', LU: 'Europe',
  RU: 'Europe', GR: 'Europe',
  // Asia
  CN: 'Asia', HK: 'Asia', TW: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', SG: 'Asia',
  ID: 'Asia', TH: 'Asia', MY: 'Asia', PH: 'Asia', VN: 'Asia', IL: 'Asia', AE: 'Asia',
  SA: 'Asia', TR: 'Asia',
  // Oceania
  AU: 'Oceania', NZ: 'Oceania',
  // Africa
  ZA: 'Africa', NG: 'Africa', EG: 'Africa',
}

export function continentForCountry(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  return CONTINENT_BY_COUNTRY[code.toUpperCase()] ?? 'Other'
}
