// Czech-locale formatting for Finance OS: space as thousands separator,
// comma as decimal separator, currency per asset (CZK/USD/EUR).
// Display only — financial math uses decimal.js, never floats.

type NumericInput = number | string | null | undefined

function toNumber(value: NumericInput): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : null
}

const EM_DASH = '—'

export function formatMoney(value: NumericInput, currency: string, decimals = 2): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  try {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'CZK' ? 'symbol' : 'code',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)
  } catch {
    // unknown currency code — fall back to plain number + code
    return `${formatNumber(n, decimals)} ${currency}`
  }
}

export function formatNumber(value: NumericInput, decimals = 2): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/** Quantity of shares — up to 6 decimals, trailing zeros trimmed. */
export function formatQuantity(value: NumericInput): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 6 }).format(n)
}

/** value = fraction (0.25 → "25,0 %"). */
export function formatPercent(value: NumericInput, decimals = 1): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return new Intl.NumberFormat('cs-CZ', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/** Signed percent for P/L: +2,4 % / −1,1 %. */
export function formatPercentSigned(value: NumericInput, decimals = 1): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  const formatted = formatPercent(Math.abs(n), decimals)
  return n < 0 ? `−${formatted}` : `+${formatted}`
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return EM_DASH
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return EM_DASH
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium' }).format(d)
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return EM_DASH
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return EM_DASH
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}
