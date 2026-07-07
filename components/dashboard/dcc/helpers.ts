import type { PlannedMeal } from './types'

export const SOURCE_LINK: Record<string, { href: string; label: string }> = {
  learning:  { href: '/learning',           label: 'Learning →' },
  fitness:   { href: '/fitness/strategy',   label: 'Fitness →' },
  career:    { href: '/career/trajectory',  label: 'Career →' },
  report:    { href: '/reports',            label: 'Reports →' },
  goal:      { href: '/quarterly',          label: 'Goals →' },
  manual:    { href: '/weekly',             label: 'Weekly →' },
  system:    { href: '/weekly',             label: 'Weekly →' },
}


export const PRIORITY_COLOR: Record<string, string> = {
  must:     '#E8907A',
  should:   '#DDB96A',
  optional: '#6E6E76',
}
export const PRIORITY_LABEL: Record<string, string> = {
  must: 'MUST',
  should: 'SHOULD',
  optional: 'OPT',
}
export const EFFORT_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Deep work' }
export const EFFORT_MINUTES: Record<number, string> = { 1: '~15m', 2: '~25m', 3: '~45m' }
export const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }

export const INTEL_COLORS: Record<string, string> = {
  geopolitics:  '#C8A06A',
  business:     '#B89A3E',
  tech:         '#8E80C4',
  society:      '#5E94BB',
  science:      '#5EAA88',
  markets:      '#B06E7E',
  psychology:   '#B06E7E',
  health:       '#5EAA88',
  fitness:      '#5EAA88',
  nutrition:    '#B89A3E',
  recovery:     '#8E80C4',
  productivity: '#C8A06A',
  habits:       '#B06E7E',
}

export function sortMeals(meals: PlannedMeal[]) {
  return [...meals].sort((a, b) => {
    const ao = MEAL_ORDER[a.mealType.toLowerCase()] ?? 9
    const bo = MEAL_ORDER[b.mealType.toLowerCase()] ?? 9
    return ao - bo
  })
}

export function parseSafeJson<T>(str: string | null | undefined): T | null {
  if (!str) return null
  try { return JSON.parse(str) as T } catch { return null }
}

export function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12)  return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  if (h >= 18 && h < 23) return 'Good evening'
  return 'Late night'
}

export function effortTimeLabel(effort: number): string {
  return EFFORT_MINUTES[effort] ?? ''
}

export const REFRESH_INTERVAL_MS = 5 * 60 * 60 * 1000

export function briefingAgeMs(generatedAt: string | Date | undefined): number {
  if (!generatedAt) return Infinity
  return Date.now() - new Date(generatedAt).getTime()
}

export function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 7_200_000) return `1h ago`
  return `${Math.floor(ms / 3_600_000)}h ago`
}
