export type GoalStatus = 'ahead' | 'on_track' | 'watch' | 'at_risk' | 'critical' | 'completed' | 'paused'

export interface GoalMetrics {
  progressPct: number
  expectedPct: number
  gap: number
  velocity: number // progress per day
  forecastedCompletionDate: Date | null
  requiredVelocity: number
  daysRemaining: number
  daysElapsed: number
  totalDays: number
  status: GoalStatus
  statusLabel: string
  recommendation: string
}

export function calcQuantitativeProgress(start: number, current: number, target: number): number {
  if (target === start) return 100
  const raw = (current - start) / (target - start) * 100
  return Math.min(100, Math.max(0, raw))
}

export function calcMilestoneProgress(milestones: { weight: number; completed: boolean }[]): number {
  if (!milestones.length) return 0
  const total = milestones.reduce((s, m) => s + m.weight, 0)
  const done = milestones.filter(m => m.completed).reduce((s, m) => s + m.weight, 0)
  return total > 0 ? (done / total) * 100 : 0
}

export function calcExpectedProgress(startDate: Date, deadline: Date, now = new Date()): number {
  const total = deadline.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

export function calcGoalMetrics(
  goal: {
    startDate: Date
    deadline: Date
    progressPct: number
    progressHistory?: { loggedAt: Date; pct: number }[]
  }
): GoalMetrics {
  const now = new Date()
  const startDate = goal.startDate
  const deadline = goal.deadline
  const progressPct = goal.progressPct

  const totalMs = deadline.getTime() - startDate.getTime()
  const elapsedMs = now.getTime() - startDate.getTime()
  const totalDays = totalMs / 86400000
  const daysElapsed = Math.max(0, elapsedMs / 86400000)
  const daysRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / 86400000)

  const expectedPct = calcExpectedProgress(startDate, deadline, now)
  const gap = progressPct - expectedPct

  // velocity = progress per day (based on all history)
  const velocity = daysElapsed > 0 ? progressPct / daysElapsed : 0

  // forecasted completion
  let forecastedCompletionDate: Date | null = null
  if (velocity > 0 && progressPct < 100) {
    const daysToComplete = (100 - progressPct) / velocity
    forecastedCompletionDate = new Date(now.getTime() + daysToComplete * 86400000)
  } else if (progressPct >= 100) {
    forecastedCompletionDate = now
  }

  // required velocity to still hit deadline
  const requiredVelocity = daysRemaining > 0 ? (100 - progressPct) / daysRemaining : Infinity

  // status
  let status: GoalStatus = 'on_track'
  if (progressPct >= 100) {
    status = 'completed'
  } else if (gap >= 10) {
    status = 'ahead'
  } else if (gap >= -5) {
    status = 'on_track'
  } else if (gap >= -15) {
    status = 'watch'
  } else if (gap >= -25) {
    status = 'at_risk'
  } else {
    status = 'critical'
  }

  const statusLabels: Record<GoalStatus, string> = {
    ahead: 'Ahead',
    on_track: 'On Track',
    watch: 'Watch',
    at_risk: 'At Risk',
    critical: 'Critical',
    completed: 'Completed',
    paused: 'Paused',
  }

  // recommendation
  let recommendation = ''
  if (status === 'completed') {
    recommendation = 'Goal completed. Consider raising the bar or moving to next priority.'
  } else if (status === 'ahead') {
    recommendation = `You're ${Math.round(gap)}% ahead of schedule. Keep pace or shift some effort to at-risk goals.`
  } else if (status === 'on_track') {
    recommendation = `On track. Maintain current pace of ${velocity.toFixed(1)}% per day.`
  } else if (status === 'watch') {
    recommendation = `Slightly behind. Increase output by ${Math.round(requiredVelocity / Math.max(0.01, velocity) * 100 - 100)}% or protect more time blocks this week.`
  } else if (status === 'at_risk') {
    const catchUpPct = Math.round(requiredVelocity / Math.max(0.01, velocity) * 100 - 100)
    recommendation = `Behind by ${Math.round(Math.abs(gap))}%. You need ${catchUpPct}% more output per day. Review scope or reallocate from lower-priority goals.`
  } else if (status === 'critical') {
    recommendation = `Critical gap of ${Math.round(Math.abs(gap))}%. At current pace, ${forecastedCompletionDate ? `forecasted completion is ${Math.round((forecastedCompletionDate.getTime() - deadline.getTime()) / 86400000)} days late` : 'completion date is uncertain'}. Immediate replanning required.`
  }

  return {
    progressPct,
    expectedPct,
    gap,
    velocity,
    forecastedCompletionDate,
    requiredVelocity,
    daysRemaining,
    daysElapsed,
    totalDays,
    status,
    statusLabel: statusLabels[status],
    recommendation,
  }
}

export function getQuarterProgress(startDate: Date, endDate: Date): {
  pct: number
  daysElapsed: number
  daysTotal: number
  daysRemaining: number
  overallStatus: string
} {
  const now = new Date()
  const total = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  const pct = Math.min(100, Math.max(0, elapsed / total * 100))
  const daysTotal = total / 86400000
  const daysElapsed = elapsed / 86400000
  const daysRemaining = Math.max(0, (endDate.getTime() - now.getTime()) / 86400000)
  return { pct, daysElapsed: Math.round(daysElapsed), daysTotal: Math.round(daysTotal), daysRemaining: Math.round(daysRemaining), overallStatus: 'active' }
}
