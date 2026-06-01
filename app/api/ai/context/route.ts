import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress, getQuarterProgress } from '@/lib/calculations'

function tp(s: string | null | undefined) {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

export async function GET() {
  try {
    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })

    // ── QUARTER + GOALS ──────────────────────────────────────────────────────
    const quarter = await prisma.quarter.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        goals: {
          include: {
            milestones: true,
            progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 3 },
          },
        },
        weeklyPlans: {
          where: { status: 'active' },
          include: { tasks: { include: { goal: true } } },
          orderBy: { weekStart: 'desc' },
          take: 1,
        },
      },
    })

    const qProgressObj = quarter ? getQuarterProgress(quarter.startDate, quarter.endDate) : null
    const qProgress = qProgressObj?.pct ?? null

    const goalsData = quarter?.goals.map(g => {
      let progressPct = 0
      if (g.trackingType === 'QUANTITATIVE' && g.startValue != null && g.targetValue != null && g.currentValue != null) {
        progressPct = calcQuantitativeProgress(g.startValue, g.currentValue, g.targetValue)
      } else if (g.trackingType === 'MILESTONE') {
        progressPct = calcMilestoneProgress(g.milestones)
      }
      const metrics = calcGoalMetrics({ startDate: quarter!.startDate, deadline: g.deadline, progressPct, progressHistory: g.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })) })
      return {
        id: g.id, title: g.title, category: g.category,
        status: metrics.status, statusLabel: metrics.statusLabel,
        progressPct: Math.round(progressPct), expectedPct: Math.round(metrics.expectedPct),
        gap: Math.round(metrics.gap), deadline: g.deadline.toISOString().split('T')[0],
        trackingType: g.trackingType, currentValue: g.currentValue, targetValue: g.targetValue,
        unit: g.unit, strategicRole: g.strategicRole,
        recommendation: metrics.recommendation,
      }
    }) ?? []

    // ── TASKS ────────────────────────────────────────────────────────────────
    const weekPlan = quarter?.weeklyPlans[0]
    const allTasks = weekPlan?.tasks ?? []
    const tasksData = {
      weeklyPlanId: weekPlan?.id ?? null,
      weekStart: weekPlan?.weekStart?.toISOString().split('T')[0] ?? null,
      total: allTasks.length,
      completed: allTasks.filter(t => t.completed).length,
      must: allTasks.filter(t => !t.completed && t.priority === 1).map(t => ({ id: t.id, title: t.title, effort: t.effort, goalTitle: t.goal?.title ?? null })),
      should: allTasks.filter(t => !t.completed && t.priority === 2).map(t => ({ id: t.id, title: t.title, effort: t.effort, goalTitle: t.goal?.title ?? null })),
      optional: allTasks.filter(t => !t.completed && t.priority === 3).map(t => ({ id: t.id, title: t.title, goalTitle: t.goal?.title ?? null })),
      completedItems: allTasks.filter(t => t.completed).map(t => ({ id: t.id, title: t.title })),
    }

    // ── FITNESS ──────────────────────────────────────────────────────────────
    const [fitnessStrategy, recentFitnessLogs, recentWorkouts] = await Promise.all([
      prisma.fitnessStrategy.findFirst({
        where: { userId: user.id, status: { in: ['active', 'draft'] } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fitnessLog.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 4,
      }),
      prisma.workoutLog.findMany({
        where: { userId: user.id, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: 'desc' },
      }),
    ])

    const fsSchedule: { day: string; sessions: string[] }[] = tp(fitnessStrategy?.weeklySchedule) ?? []
    const fsStrength = tp(fitnessStrategy?.strengthPlan)
    const fsCardio   = tp(fitnessStrategy?.cardioPlan)
    const fsNutrDir  = tp(fitnessStrategy?.nutritionDir)
    const fsTargets  = tp(fitnessStrategy?.weeklyTargets)
    const latestLog  = recentFitnessLogs[0]

    // This week's schedule changes
    const weekId = (() => {
      const d = new Date(); const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day; const mon = new Date(d)
      mon.setDate(d.getDate() + diff); return mon.toISOString().split('T')[0]
    })()
    const scheduleChanges = await prisma.fitnessScheduleChange.findMany({
      where: { userId: user.id, weekId, undone: false },
    })
    const completedSessions = scheduleChanges.filter(c => c.action === 'completed').map(c => c.sessionLabel)
    const removedSessions   = scheduleChanges.filter(c => c.action === 'removed').map(c => c.sessionLabel)

    const plannedCount = fsSchedule.reduce((s, d) => s + (d.sessions?.length ?? 0), 0)

    const fitnessData = {
      strategyId: fitnessStrategy?.id ?? null,
      strategyStatus: fitnessStrategy?.status ?? 'none',
      objective: fitnessStrategy?.mainObjective ?? null,
      strengthSessions: fsStrength?.sessionsPerWeek ?? null,
      cardioSessions: fsCardio?.sessionsPerWeek ?? null,
      saunaSessions: null as number | null,
      sessionDuration: fsStrength?.sessionDuration ?? null,
      proteinTarget: fsNutrDir?.proteinTarget ?? null,
      schedule: fsSchedule.map(d => ({ day: d.day, sessions: d.sessions?.filter(s => !removedSessions.includes(s)) ?? [] })),
      thisWeek: {
        planned: plannedCount,
        completed: completedSessions.length,
        removed: removedSessions.length,
        completedSessions,
        removedSessions,
        workoutLogs: recentWorkouts.map(w => ({ date: w.date.toISOString().split('T')[0], type: w.type })),
      },
      lastMeasurement: latestLog ? {
        date: latestLog.date.toISOString().split('T')[0],
        weight: latestLog.weight,
        waist: latestLog.waist,
      } : null,
      weeklyTargets: fsTargets,
      risks: fitnessStrategy?.risks ?? null,
      decisionRules: fitnessStrategy?.decisionRules ?? null,
    }

    // ── NUTRITION ────────────────────────────────────────────────────────────
    const todayDOW = today.getDay()
    const [activeMealPlan, todayProtein, recipeCount] = await Promise.all([
      prisma.mealPlan.findFirst({
        where: { userId: user.id, status: { in: ['approved', 'draft'] }, weekStart: { lte: today } },
        include: { meals: true },
        orderBy: { weekStart: 'desc' },
      }),
      prisma.proteinLog.findFirst({
        where: { userId: user.id, date: { gte: today } },
        orderBy: { date: 'desc' },
      }),
      prisma.recipe.count({ where: { userId: user.id } }),
    ])

    const todayMeals = activeMealPlan?.meals.filter(m => m.dayOfWeek === todayDOW) ?? []
    const nutritionData = {
      proteinTarget: todayProtein?.target ?? fsNutrDir?.proteinTarget ?? null,
      proteinToday: todayProtein?.amount ?? null,
      activeMealPlan: activeMealPlan ? {
        id: activeMealPlan.id,
        weekStart: activeMealPlan.weekStart.toISOString().split('T')[0],
        status: activeMealPlan.status,
        totalMeals: activeMealPlan.meals.length,
        todayMeals: todayMeals.map(m => ({ meal: m.mealType, title: m.title, protein: m.protein, calories: m.calories })),
      } : null,
      savedRecipes: recipeCount,
    }

    // ── CAREER ───────────────────────────────────────────────────────────────
    const [careerTrajectory, careerItems] = await Promise.all([
      prisma.careerTrajectory.findFirst({
        where: { userId: user.id, status: 'active' },
        include: { gaps: { where: { closed: false }, take: 5 } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.careerCapitalItem.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ])

    const careerData = careerTrajectory ? {
      currentRole: careerTrajectory.currentRole,
      targetRole: careerTrajectory.targetRoleTitle ?? careerTrajectory.targetPath,
      readinessScore: careerTrajectory.readinessScore,
      openGaps: (careerTrajectory as typeof careerTrajectory & { gaps: { id: string; title: string; priority: number; nextBestAction: string | null }[] }).gaps.map(g => ({ id: g.id, area: g.title, severity: g.priority, action: g.nextBestAction })),
      recentCapital: careerItems.map(c => ({ title: c.title, category: c.category })),
    } : null

    // ── LEARNING ─────────────────────────────────────────────────────────────
    const learningRoadmaps = await prisma.capabilityGoal.findMany({
      where: { userId: user.id, status: { in: ['active', 'not_started'] } },
      include: {
        milestones: {
          include: { steps: true },
          orderBy: { order: 'asc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })

    const learningData = learningRoadmaps.map(r => {
      const totalSteps = r.milestones.reduce((s, m) => s + m.steps.length, 0)
      const doneSteps = r.milestones.reduce((s, m) => s + m.steps.filter(st => st.completed).length, 0)
      return {
        id: r.id, title: r.title,
        status: r.healthStatus, type: r.roadmapType,
        progress: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
        totalSteps, doneSteps,
        deadline: r.deadline?.toISOString().split('T')[0] ?? null,
      }
    })

    // ── FINANCE ──────────────────────────────────────────────────────────────
    const [latestImport, financeWorkbook] = await Promise.all([
      prisma.financeImport.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financeWorkbook.findUnique({ where: { userId: user.id } }),
    ])

    let topCategories: string[] = []
    if (latestImport) {
      const txs = await prisma.financeTransaction.findMany({
        where: { importId: latestImport.id, amount: { lt: 0 } },
        orderBy: { amount: 'asc' },
        take: 100,
      })
      const byCat: Record<string, number> = {}
      for (const t of txs) {
        const cat = t.category ?? 'Uncategorized'
        byCat[cat] = (byCat[cat] ?? 0) + Math.abs(t.amount)
      }
      topCategories = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amt]) => `${cat}: ${Math.round(amt).toLocaleString()}`)
    }

    const financeData = {
      hasWorkbook: !!financeWorkbook,
      workbookName: financeWorkbook?.fileName ?? null,
      latestImport: latestImport ? {
        date: latestImport.createdAt.toISOString().split('T')[0],
        label: latestImport.statementMonth,
        source: latestImport.sourceFileName ?? null,
      } : null,
      topSpendCategories: topCategories,
    }

    // ── PATTERNS ─────────────────────────────────────────────────────────────
    const patterns = await prisma.behaviorPattern.findMany({
      where: { userId: user.id, active: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    })

    const patternsData = patterns.map(p => ({
      id: p.id, domain: p.domain, pattern: p.pattern,
      confidence: p.confidence, implication: p.implication,
    }))

    // ── LATEST REPORT ─────────────────────────────────────────────────────────
    const latestReport = await prisma.weeklyReport.findFirst({
      where: { userId: user.id },
      orderBy: { weekStart: 'desc' },
    })

    const reportData = latestReport ? {
      week: latestReport.weekStart.toISOString().split('T')[0],
      status: latestReport.status,
      summary: latestReport.chiefOfStaffMsg ?? latestReport.executiveSummary ?? null,
    } : null

    // ── HABITS ───────────────────────────────────────────────────────────────
    const [alcoholSettings, weekAlcohol] = await Promise.all([
      prisma.alcoholSettings.findUnique({ where: { userId: user.id } }),
      prisma.alcoholLog.aggregate({
        where: { userId: user.id, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        _sum: { drinks: true },
      }),
    ])

    const habitsData = {
      weeklyBudget: alcoholSettings?.weeklyBudget ?? null,
      weeklyDrinks: weekAlcohol._sum.drinks ?? 0,
      goal: alcoholSettings?.goal ?? null,
    }

    // ── ANTI-DRIFT ────────────────────────────────────────────────────────────
    const pendingWorkItems = await prisma.workItem.count({
      where: { userId: user.id },
    })

    return NextResponse.json({
      meta: { date: todayStr, dayOfWeek, userId: user.id },
      quarter: quarter ? {
        id: quarter.id,
        name: quarter.name,
        startDate: quarter.startDate.toISOString().split('T')[0],
        endDate: quarter.endDate.toISOString().split('T')[0],
        progressPct: Math.round(qProgress ?? 0),
        goalsCount: quarter.goals.length,
      } : null,
      goals: goalsData,
      tasks: tasksData,
      fitness: fitnessData,
      nutrition: nutritionData,
      career: careerData,
      learning: learningData,
      finance: financeData,
      patterns: patternsData,
      latestReport: reportData,
      habits: habitsData,
      antiDrift: { pendingItems: pendingWorkItems },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
