// Shared types for the live weekly report.
// Kept here (not in an API route file) so client components can import safely.

export interface GoalLive {
  id: string
  title: string
  category: string
  currentPct: number
  expectedPct: number
  gap: number
  weekDelta: number
  status: 'ahead' | 'on_track' | 'watch' | 'at_risk' | 'critical' | 'no_data'
  unit: string | null
  daysToDeadline: number
  nextMilestone: string | null
}

export interface WeekLiveData {
  computedAt: string
  weekProgress: number
  daysLeft: number
  snapshot: {
    status: 'thriving' | 'stable' | 'watch' | 'risk' | 'recovery'
    wins: string[]
    risks: string[]
    focus: string | null
    systemNote: string | null
  }
  goals: GoalLive[]
  tasks: {
    planned: number
    completed: number
    missed: number
    rate: number
    p1Planned: number
    p1Completed: number
    p1Rate: number
  } | null
  fitness: {
    workoutsThisWeek: number
    weeklyTarget: number
    types: string[]
    proteinAvg: number | null
  }
  learning: Array<{
    id: string
    title: string
    healthStatus: string
    stepsCompleted: number
    stepsTotal: number
    weekStepsCompleted: number
  }>
  career: {
    itemsThisWeek: number
    types: string[]
  }
  finance: {
    latestMonth: string | null
    latestStatus: string | null
    hasReport: boolean
  }
  antiDrift: {
    advancementPct: number
    maintenancePct: number
    reactivePct: number
    busyworkPct: number
    total: number
  }
  domains: Array<{
    name: string
    status: 'thriving' | 'stable' | 'watch' | 'risk' | 'inactive'
    bullets: string[]
    nextAction: string | null
  }>
  forecast: Array<{
    id: string
    title: string
    currentPct: number
    weeklyVelocity: number
    daysToDeadline: number
    projectedFinalPct: number
    status: 'ahead' | 'on_track' | 'late' | 'stalled'
    daysLate: number
  }>
  avatar: {
    xpThisWeek: number
    tasksCompleted: number
    goalsAdvanced: number
    workoutsLogged: number
    strongestDomain: string | null
    weekRating: number
  }
  ai: null | {
    generatedAt: string
    executiveBullets: string[]
    taskPatterns: string[]
    nextWeekPriorities: string[]
    nextWeekTasks: Array<{ title: string; why: string; day?: string }>
    toDrop: string[]
    systemAdjustments: string[]
    chiefMsg: string
  }
}
