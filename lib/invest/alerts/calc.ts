// Pure helpers for the alert engine — no DB, unit-tested.

/** Linear-interpolated percentile (p as fraction 0–1) of a sample. */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const clamped = Math.min(Math.max(p, 0), 1)
  const idx = clamped * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * Current drawdown from the running peak of a price series (chronological
 * order). 0.15 = price sits 15 % below the period peak. Null for empty input.
 */
export function drawdownFromPeak(prices: number[]): { drawdown: number; peak: number } | null {
  const valid = prices.filter((p) => Number.isFinite(p) && p > 0)
  if (valid.length === 0) return null
  const peak = Math.max(...valid)
  const current = valid[valid.length - 1]
  return { drawdown: (peak - current) / peak, peak }
}

/** Cooldown guard: true while the rule must stay quiet after its last trigger. */
export function isInCooldown(
  lastTriggeredAt: Date | null,
  cooldownHours: number,
  now: Date = new Date(),
): boolean {
  if (!lastTriggeredAt) return false
  return now.getTime() - lastTriggeredAt.getTime() < cooldownHours * 3_600_000
}

export function monthsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return ms / (30.44 * 24 * 3_600_000)
}
