// Formátovací pomocníky pro realitní kalkulačku (CZK, cs-CZ).

export function formatCZK(value: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)
}

/** Kompaktní zápis částek pro grafy: 1,2 mil., 850 tis. */
export function formatCZKCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} mil.`
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString('cs-CZ')} tis.`
  return Math.round(value).toLocaleString('cs-CZ')
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)} %`
}

export function formatPctSigned(value: number, decimals = 1): string {
  const s = value >= 0 ? '+' : ''
  return `${s}${value.toFixed(decimals)} %`
}
