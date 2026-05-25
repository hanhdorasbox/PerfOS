import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(now: Date) {
  const day = now.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

function goalStatus(gap: number): GoalLive['status'] {
  if (gap >= 10) return 'ahead'
  if (gap >= -5) return 'on_track'
  if (gap >= -15) return 'watch'
  if (gap >= -30) return 'at_risk'
  return 'critical'
}

// ─── Compute ──────────────────────────────────────────────────────────────────

async function compute(userId: string, weekStart: Date, weekEnd: Date): Promise<WeekLiveData> {
  const now = new Date()
  const weekMs = weekEnd.getTime() - weekStart.getTime()
  const elapsedMs = now.getTime() - weekStart.getTime()
  const weekProgress = Math.min(100, Math.max(0, Math.round((elapsedMs / weekMs) * 100)))
  const daysLeft = Math.max(0, Math.round((weekEnd.getTime() - now.getTime()) / 86400000))

  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)

  const [quarter, workoutLogs, proteinLogs, workItems, learningGoals, careerItems, financeImport] = await Promise.all([
    prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      include: {
        goals: {
          where: { status: 'active' },
          include: {
            progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 20 },
            milestones: true,
          },
        },
        weeklyPlans: {
          where: { weekStart: { gte: weekStart, lte: weekEnd } },
          include: { tasks: true },
          take: 1,
        },
      },
    }),
    prisma.workoutLog.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    prisma.proteinLog.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    prisma.workItem.findMany({ where: { userId, weekStart: { gte: weekStart, lte: weekEnd } } }),
    prisma.capabilityGoal.findMany({
      where: { userId, status: 'active' },
      include: {
        milestones: {
          include: { steps: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.careerCapitalItem.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    prisma.financeImport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { report: true } }),
  ])

  // ── Goals ──────────────────────────────────────────────────────────────────

  const goals: GoalLive[] = []
  let goalsAhead = 0, goalsAtRisk = 0

  if (quarter) {
    const totalDays = (quarter.endDate.getTime() - quarter.startDate.getTime()) / 86400000
    const daysElapsed = (now.getTime() - quarter.startDate.getTime()) / 86400000
    const expectedPct = Math.min(100, Math.round((daysElapsed / totalDays) * 100))

    for (const goal of quarter.goals) {
      let currentPct = 0
      let weekDelta = 0

      if (goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null && goal.currentValue != null) {
        const range = goal.targetValue - goal.startValue
        if (range !== 0) {
          currentPct = Math.min(100, Math.max(0, Math.round(((goal.currentValue - goal.startValue) / range) * 100)))
          const weekStartUpdate = goal.progressUpdates.find(u => u.loggedAt < weekStart)
          const weekStartVal = weekStartUpdate?.value ?? goal.startValue
          weekDelta = Math.round(((goal.currentValue - weekStartVal) / range) * 100)
        }
      } else if (goal.trackingType === 'MILESTONE') {
        const total = goal.milestones.length || 1
        const done = goal.milestones.filter(m => m.completed).length
        currentPct = Math.round((done / total) * 100)
        const weekDone = goal.milestones.filter(m => m.completed && m.completedAt && m.completedAt >= weekStart).length
        weekDelta = Math.round((weekDone / total) * 100)
      }

      const gap = currentPct - expectedPct
      const status = goalStatus(gap)
      if (status === 'ahead') goalsAhead++
      if (status === 'at_risk' || status === 'critical') goalsAtRisk++

      const daysToDeadline = Math.round((goal.deadline.getTime() - now.getTime()) / 86400000)
      const nextMilestone = goal.milestones.find(m => !m.completed)?.title ?? null

      goals.push({ id: goal.id, title: goal.title, category: goal.category, currentPct, expectedPct, gap, weekDelta, status, unit: goal.unit ?? null, daysToDeadline, nextMilestone })
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  let tasks: WeekLiveData['tasks'] = null
  const weekPlan = quarter?.weeklyPlans?.[0]
  if (weekPlan) {
    const all = weekPlan.tasks
    const done = all.filter(t => t.completed)
    const p1 = all.filter(t => t.priority === 1)
    const p1done = p1.filter(t => t.completed)
    tasks = {
      planned: all.length, completed: done.length, missed: all.length - done.length,
      rate: all.length > 0 ? Math.round((done.length / all.length) * 100) : 0,
      p1Planned: p1.length, p1Completed: p1done.length,
      p1Rate: p1.length > 0 ? Math.round((p1done.length / p1.length) * 100) : 0,
    }
  }

  // ── Anti-Drift ────────────────────────────────────────────────────────────

  const total = workItems.length || 1
  const antiDrift = {
    advancementPct: Math.round((workItems.filter(w => w.category === 'advancement').length / total) * 100),
    maintenancePct: Math.round((workItems.filter(w => w.category === 'maintenance').length / total) * 100),
    reactivePct: Math.round((workItems.filter(w => w.category === 'reactive').length / total) * 100),
    busyworkPct: Math.round((workItems.filter(w => w.category === 'busywork').length / total) * 100),
    total: workItems.length,
  }

  // ── Fitness ───────────────────────────────────────────────────────────────

  const fitnessTypes = [...new Set(workoutLogs.map(w => w.type))]
  const proteinAvg = proteinLogs.length > 0
    ? Math.round(proteinLogs.reduce((s, p) => s + p.amount, 0) / proteinLogs.length)
    : null

  const fitness: WeekLiveData['fitness'] = {
    workoutsThisWeek: workoutLogs.length,
    weeklyTarget: 3,
    types: fitnessTypes,
    proteinAvg,
  }

  // ── Learning ──────────────────────────────────────────────────────────────

  const learning: WeekLiveData['learning'] = learningGoals.map(g => {
    const allSteps = g.milestones.flatMap(m => m.steps)
    const stepsCompleted = allSteps.filter(s => s.completed).length
    const stepsTotal = allSteps.length
    const weekSteps = allSteps.filter(s => s.completed && s.completedAt && s.completedAt >= weekStart).length
    return { id: g.id, title: g.title, healthStatus: g.healthStatus, stepsCompleted, stepsTotal, weekStepsCompleted: weekSteps }
  })

  // ── Career ────────────────────────────────────────────────────────────────

  const career: WeekLiveData['career'] = {
    itemsThisWeek: careerItems.length,
    types: [...new Set(careerItems.map(c => c.type))],
  }

  // ── Finance ───────────────────────────────────────────────────────────────

  const finance: WeekLiveData['finance'] = {
    latestMonth: financeImport?.statementMonth ?? null,
    latestStatus: financeImport?.status ?? null,
    hasReport: !!financeImport?.report,
  }

  // ── Domain breakdown ─────────────────────────────────────────────────────

  type DomainStatus = 'thriving' | 'stable' | 'watch' | 'risk' | 'inactive'
  const domains: WeekLiveData['domains'] = []

  // Career
  const careerGoals = goals.filter(g => ['career', 'work', 'professional'].includes(g.category.toLowerCase()))
  const careerRisk = careerGoals.filter(g => g.status === 'at_risk' || g.status === 'critical').length
  domains.push({
    name: 'Career',
    status: (careerItems.length > 0 ? (careerRisk > 0 ? 'watch' : 'stable') : 'inactive') as DomainStatus,
    bullets: [
      careerItems.length > 0 ? `${careerItems.length} career capital item${careerItems.length !== 1 ? 's' : ''} logged` : 'No career items logged this week',
      ...careerGoals.length > 0 ? [`${careerGoals.filter(g => g.status === 'ahead' || g.status === 'on_track').length}/${careerGoals.length} career goals on track`] : [],
    ],
    nextAction: careerRisk > 0 ? 'Review at-risk career goal and log proof-of-work' : null,
  })

  // Learning
  const stalledLearning = learning.filter(g => g.healthStatus === 'stalled' || g.healthStatus === 'behind')
  const learningStatus: DomainStatus = learning.length === 0 ? 'inactive' : stalledLearning.length > 0 ? 'watch' : learning.some(g => g.weekStepsCompleted > 0) ? 'stable' : 'watch'
  domains.push({
    name: 'Learning',
    status: learningStatus,
    bullets: [
      `${learning.length} active roadmap${learning.length !== 1 ? 's' : ''}`,
      learning.reduce((s, g) => s + g.weekStepsCompleted, 0) > 0
        ? `${learning.reduce((s, g) => s + g.weekStepsCompleted, 0)} step${learning.reduce((s, g) => s + g.weekStepsCompleted, 0) !== 1 ? 's' : ''} completed this week`
        : 'No steps completed this week',
      ...stalledLearning.length > 0 ? [`${stalledLearning.length} roadmap${stalledLearning.length !== 1 ? 's' : ''} stalled`] : [],
    ],
    nextAction: stalledLearning.length > 0 ? `Resume ${stalledLearning[0].title}` : null,
  })

  // Fitness
  const fitnessStatus: DomainStatus = workoutLogs.length >= 3 ? 'stable' : workoutLogs.length >= 1 ? 'watch' : 'risk'
  domains.push({
    name: 'Fitness',
    status: fitnessStatus,
    bullets: [
      `${workoutLogs.length}/3 workouts this week`,
      ...fitnessTypes.length > 0 ? [`Types: ${fitnessTypes.join(', ')}`] : [],
      ...proteinAvg !== null ? [`Avg protein: ${proteinAvg}g/day`] : [],
    ],
    nextAction: workoutLogs.length < 3 ? `${3 - workoutLogs.length} more workout${3 - workoutLogs.length !== 1 ? 's' : ''} to hit weekly target` : null,
  })

  // Finance
  const financeStatus: DomainStatus = finance.latestStatus === 'approved' ? 'stable' : finance.latestStatus === 'pending_review' ? 'watch' : finance.latestStatus === null ? 'inactive' : 'stable'
  domains.push({
    name: 'Finance',
    status: financeStatus,
    bullets: [
      finance.latestMonth ? `Latest import: ${finance.latestMonth}` : 'No imports yet',
      finance.latestStatus ? `Status: ${finance.latestStatus.replace('_', ' ')}` : '',
    ].filter(Boolean),
    nextAction: finance.latestStatus === 'pending_review' ? 'Review and approve pending transactions' : !finance.hasReport && finance.latestStatus === 'approved' ? 'Generate monthly finance report' : null,
  })

  // ── Forecast ─────────────────────────────────────────────────────────────

  const forecast: WeekLiveData['forecast'] = goals.map(g => {
    const progressNeeded = 100 - g.currentPct
    const weeksToDeadline = g.daysToDeadline / 7
    const projectedFinalPct = weeksToDeadline > 0
      ? Math.min(100, Math.round(g.currentPct + g.weekDelta * weeksToDeadline))
      : g.currentPct

    let daysLate = 0
    if (g.weekDelta > 0) {
      const weeksNeeded = progressNeeded / g.weekDelta
      daysLate = Math.round((weeksNeeded - weeksToDeadline) * 7)
    } else if (progressNeeded > 0) {
      daysLate = g.daysToDeadline + 999 // effectively stalled
    }

    const fStatus: GoalLive['status'] =
      g.weekDelta === 0 && g.currentPct < 100 ? 'stalled' as any :
      projectedFinalPct >= 100 && daysLate <= 0 ? 'ahead' as any :
      projectedFinalPct >= 95 ? 'on_track' as any : 'late' as any

    return {
      id: g.id, title: g.title, currentPct: g.currentPct,
      weeklyVelocity: g.weekDelta, daysToDeadline: g.daysToDeadline,
      projectedFinalPct, status: fStatus as any, daysLate,
    }
  })

  // ── Avatar ────────────────────────────────────────────────────────────────

  const tasksCompleted = tasks?.completed ?? 0
  const goalsAdvanced = goals.filter(g => g.weekDelta > 0).length
  const xpThisWeek = tasksCompleted * 10 + goalsAdvanced * 50 + workoutLogs.length * 20 + careerItems.length * 15

  const domainXP: Record<string, number> = {
    Career: careerItems.length * 15 + careerGoals.filter(g => g.weekDelta > 0).length * 50,
    Learning: learning.reduce((s, g) => s + g.weekStepsCompleted * 15, 0),
    Fitness: workoutLogs.length * 20,
    Finance: finance.latestStatus === 'approved' ? 10 : 0,
  }
  const strongestDomain = Object.entries(domainXP).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const weekRating = Math.min(5, Math.max(1,
    Math.round(1 +
      (tasks ? tasks.rate / 100 : 0) * 1.5 +
      (goals.filter(g => g.status === 'ahead' || g.status === 'on_track').length / Math.max(1, goals.length)) * 1.5 +
      (workoutLogs.length / 3) * 1
    )
  ))

  const avatar: WeekLiveData['avatar'] = {
    xpThisWeek, tasksCompleted, goalsAdvanced, workoutsLogged: workoutLogs.length,
    strongestDomain, weekRating,
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────

  const taskRate = tasks?.rate ?? 50
  const advPct = antiDrift.advancementPct

  let snapshotStatus: WeekLiveData['snapshot']['status']
  if (goalsAtRisk === 0 && taskRate >= 75 && advPct >= 35) snapshotStatus = 'thriving'
  else if (goalsAtRisk <= 1 && taskRate >= 55 && weekProgress < 80) snapshotStatus = 'stable'
  else if (goalsAtRisk <= 2 || taskRate >= 40) snapshotStatus = 'watch'
  else if (goalsAtRisk > 2 || taskRate < 30) snapshotStatus = 'risk'
  else snapshotStatus = 'recovery'

  const wins: string[] = []
  const risks: string[] = []

  if (workoutLogs.length >= 3) wins.push(`Fitness: ${workoutLogs.length} workouts completed`)
  if (goalsAhead > 0) wins.push(`${goalsAhead} goal${goalsAhead !== 1 ? 's' : ''} ahead of schedule`)
  if (tasks && tasks.rate >= 70) wins.push(`Task completion: ${tasks.rate}%`)
  if (career.itemsThisWeek > 0) wins.push(`${career.itemsThisWeek} career capital item${career.itemsThisWeek !== 1 ? 's' : ''} added`)
  if (learning.some(g => g.weekStepsCompleted > 0)) wins.push(`Learning: ${learning.reduce((s, g) => s + g.weekStepsCompleted, 0)} steps done`)

  if (goalsAtRisk > 0) risks.push(`${goalsAtRisk} goal${goalsAtRisk !== 1 ? 's' : ''} at risk or critical`)
  if (tasks && tasks.rate < 50) risks.push(`Task completion low: ${tasks.rate}%`)
  if (stalledLearning.length > 0) risks.push(`${stalledLearning.length} learning roadmap${stalledLearning.length !== 1 ? 's' : ''} stalled`)
  if (workoutLogs.length === 0 && weekProgress > 50) risks.push('No workouts logged yet this week')
  if (finance.latestStatus === 'pending_review') risks.push('Finance: transactions pending review')

  const worstGoal = goals.filter(g => g.status === 'at_risk' || g.status === 'critical')[0]
  const focus = worstGoal ? `Focus on ${worstGoal.title}` : stalledLearning[0] ? `Resume ${stalledLearning[0].title}` : tasks && tasks.missed > 2 ? 'Clear missed tasks first' : null

  // ── Build liveData ────────────────────────────────────────────────────────

  const liveData: WeekLiveData = {
    computedAt: new Date().toISOString(),
    weekProgress, daysLeft,
    snapshot: {
      status: snapshotStatus,
      wins: wins.slice(0, 3),
      risks: risks.slice(0, 3),
      focus,
      systemNote: antiDrift.busyworkPct > 30 ? 'High busywork detected — review if tasks are goal-linked' : antiDrift.reactivePct > 40 ? 'High reactive load — protect focus blocks next week' : null,
    },
    goals,
    tasks,
    fitness,
    learning,
    career,
    finance,
    antiDrift,
    domains,
    forecast,
    avatar,
    ai: null,
  }

  return liveData
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { weekStart, weekEnd } = getWeekBounds(new Date())

  let report = await prisma.weeklyReport.findFirst({
    where: { userId, isLive: true, weekStart: { gte: weekStart, lte: weekEnd } },
    orderBy: { updatedAt: 'desc' },
  })

  if (!report) {
    // Auto-compute on first load
    const liveData = await compute(userId, weekStart, weekEnd)
    const status = liveData.snapshot.status
    report = await prisma.weeklyReport.create({
      data: { userId, weekStart, weekEnd, isLive: true, status, liveData: JSON.stringify(liveData) },
    })
  }

  return NextResponse.json(report)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const now = new Date()
    const { weekStart, weekEnd } = getWeekBounds(now)

    // Archive stale live reports from previous weeks
    await prisma.weeklyReport.updateMany({
      where: { userId, isLive: true, weekEnd: { lt: weekStart } },
      data: { isLive: false },
    })

    const liveData = await compute(userId, weekStart, weekEnd)
    const status = liveData.snapshot.status

    // Find existing live report for this week and preserve AI enrichment
    const existing = await prisma.weeklyReport.findFirst({
      where: { userId, isLive: true, weekStart: { gte: weekStart, lte: weekEnd } },
    })

    if (existing) {
      // Merge: preserve ai field if it exists
      const existingData = existing.liveData ? JSON.parse(existing.liveData) as WeekLiveData : null
      if (existingData?.ai) liveData.ai = existingData.ai

      const updated = await prisma.weeklyReport.update({
        where: { id: existing.id },
        data: { liveData: JSON.stringify(liveData), status },
      })
      return NextResponse.json(updated)
    } else {
      const created = await prisma.weeklyReport.create({
        data: { userId, weekStart, weekEnd, isLive: true, status, liveData: JSON.stringify(liveData) },
      })
      return NextResponse.json(created)
    }
  } catch (e) {
    console.error('[POST /api/reports/live]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
