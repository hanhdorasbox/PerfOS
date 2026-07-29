// Shared severity/confidence → token-colour mapping for InsightCard, so
// Operating Manual's 1–5 confidence and Trajectory's High/Med/Low map onto one
// visual language instead of two hardcoded systems.

export type SevLevel = 'high' | 'med' | 'low'

/** Token colour for a severity level — high = danger, med = warning, low = accent. */
export function sevColor(level: SevLevel): string {
  return level === 'high' ? 'var(--danger)' : level === 'med' ? 'var(--warning)' : 'var(--accent)'
}

/** Operating Manual: a 1–5 confidence score. 5 = high, 3–4 = med, ≤2 = low. */
export function confidenceToLevel(confidence: number): SevLevel {
  if (confidence >= 5) return 'high'
  if (confidence >= 3) return 'med'
  return 'low'
}

/** Trajectory: gap priority (1 = High, 2 = Med, 3 = Low). */
export function priorityToLevel(priority: number): SevLevel {
  if (priority <= 1) return 'high'
  if (priority === 2) return 'med'
  return 'low'
}
