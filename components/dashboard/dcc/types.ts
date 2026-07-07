// Shared types for the Daily Command Center

export interface DailyBriefing {
  id: string
  summary: string
  instruction: string
  directive: string
  priorities: string | null
  worldBriefing: string | null
  relevantUpdates: string | null
  externalContext: string | null
  dailyFacts: string | null
  generatedAt: string | Date
}

export interface DailyFact {
  category: 'psychology' | 'health' | 'fitness'
  fact: string
  whyItMatters: string
}

export interface GoalWithMetrics {
  id: string
  title: string
  category: string
  metrics: { status: string; gap: number; statusLabel: string }
}

export interface WeeklyTask {
  id: string
  title: string
  completed: boolean
  effort: number
  priority: number
  estimatedMinutes?: number | null
  goal?: { id: string; title: string; category: string } | null
  sourceModule?: string | null
  sourceType?:   string | null
  sourceId?:     string | null
}

export interface FitnessStrategy {
  mainObjective: string
  weeklySchedule: string | null
  nutritionDir: string | null
}

export interface PlannedMeal {
  id: string
  dayOfWeek: number
  mealType: string
  title: string
  description: string | null
  calories: number | null
  protein: number | null
}

export interface BriefingPriority {
  text: string
  priority: 'must' | 'should' | 'optional'
  goalTitle: string | null
  whyToday: string
}

export interface WorldItem {
  headline: string
  why: string
  category: string
}

export interface RelevantItem {
  topic: string
  update: string
}

export interface MicroStep {
  title: string
  estimatedMinutes: number
}

export interface IntelItem {
  category: string
  headline: string
  why: string
}
