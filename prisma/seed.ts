import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.careerCapitalGoalEval.deleteMany()
  await prisma.careerCapitalItem.deleteMany()
  await prisma.proofOfWork.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.weeklyTask.deleteMany()
  await prisma.weeklyPlan.deleteMany()
  await prisma.progressUpdate.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.quarter.deleteMany()
  await prisma.longTermGoal.deleteMany()
  await prisma.workoutLog.deleteMany()
  await prisma.proteinLog.deleteMany()
  await prisma.fitnessLog.deleteMany()
  await prisma.aIConversation.deleteMany()
  await prisma.user.deleteMany()

  const user = await prisma.user.create({
    data: { name: 'Hanh', email: 'hanh@example.com' }
  })

  await prisma.longTermGoal.createMany({
    data: [
      { userId: user.id, title: 'Become Senior Data/Business Analyst', category: 'Career', targetYear: 2027, description: 'Move from junior BA/DA to a senior analytical or strategic operations role', status: 'active' },
      { userId: user.id, title: 'Financial Independence — 500k CZK saved', category: 'Finance', targetYear: 2030, description: 'Build emergency fund → invest → achieve financial buffer', status: 'active' },
    ]
  })

  const quarter = await prisma.quarter.create({
    data: {
      userId: user.id,
      name: 'Q2 2026',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
      status: 'active',
    }
  })

  // Goal 1: SQL mastery
  const goalSQL = await prisma.goal.create({
    data: {
      quarterId: quarter.id,
      userId: user.id,
      title: 'SQL mastery — reach advanced level',
      category: 'Career',
      priorityWeight: 2.0,
      trackingType: 'QUANTITATIVE',
      startValue: 40,
      targetValue: 90,
      currentValue: 55,
      unit: '% mastery',
      deadline: new Date('2026-06-30'),
      status: 'active',
    }
  })

  // Progress updates for SQL (weekly, past 6 weeks)
  const sqlUpdates = [
    { daysAgo: 42, value: 40 }, { daysAgo: 35, value: 43 }, { daysAgo: 28, value: 47 },
    { daysAgo: 21, value: 50 }, { daysAgo: 14, value: 52 }, { daysAgo: 7, value: 55 },
  ]
  for (const u of sqlUpdates) {
    const date = new Date(); date.setDate(date.getDate() - u.daysAgo)
    await prisma.progressUpdate.create({ data: { goalId: goalSQL.id, value: u.value, note: 'Weekly check-in', loggedAt: date } })
  }

  // Goal 2: Fitness waist
  const goalFitness = await prisma.goal.create({
    data: {
      quarterId: quarter.id,
      userId: user.id,
      title: 'Reduce waist to 68 cm',
      category: 'Fitness',
      priorityWeight: 1.5,
      trackingType: 'QUANTITATIVE',
      startValue: 72,
      targetValue: 68,
      currentValue: 71.2,
      unit: 'cm',
      deadline: new Date('2026-06-30'),
      status: 'active',
    }
  })

  const waistUpdates = [
    { daysAgo: 42, value: 72 }, { daysAgo: 35, value: 71.8 }, { daysAgo: 28, value: 71.5 },
    { daysAgo: 21, value: 71.4 }, { daysAgo: 14, value: 71.3 }, { daysAgo: 7, value: 71.2 },
  ]
  for (const u of waistUpdates) {
    const date = new Date(); date.setDate(date.getDate() - u.daysAgo)
    await prisma.progressUpdate.create({ data: { goalId: goalFitness.id, value: u.value, loggedAt: date } })
  }

  // Goal 3: Portfolio milestone-based
  const goalPortfolio = await prisma.goal.create({
    data: {
      quarterId: quarter.id,
      userId: user.id,
      title: 'Launch DA portfolio on GitHub',
      category: 'Career',
      priorityWeight: 1.5,
      trackingType: 'MILESTONE',
      startValue: 0,
      targetValue: 100,
      currentValue: 50,
      unit: '%',
      deadline: new Date('2026-06-30'),
      status: 'active',
    }
  })

  await prisma.milestone.createMany({
    data: [
      { goalId: goalPortfolio.id, title: 'Set up GitHub profile and repo structure', weight: 15, completed: true, completedAt: new Date('2026-04-10') },
      { goalId: goalPortfolio.id, title: 'Publish 2 SQL analysis projects with documentation', weight: 35, completed: true, completedAt: new Date('2026-04-28') },
      { goalId: goalPortfolio.id, title: 'Add Power BI dashboard project with README', weight: 30, completed: false, dueDate: new Date('2026-05-31') },
      { goalId: goalPortfolio.id, title: 'Write LinkedIn post and get 3 referrals/connections from it', weight: 20, completed: false, dueDate: new Date('2026-06-15') },
    ]
  })

  // Fitness logs
  const fitnessEntries = [
    { daysAgo: 42, weight: 72.5, waist: 72.0 }, { daysAgo: 35, weight: 72.2, waist: 71.8 },
    { daysAgo: 28, weight: 71.9, waist: 71.5 }, { daysAgo: 21, weight: 71.8, waist: 71.4 },
    { daysAgo: 14, weight: 71.5, waist: 71.3 }, { daysAgo: 7, weight: 71.3, waist: 71.2 },
  ]
  for (const e of fitnessEntries) {
    const date = new Date(); date.setDate(date.getDate() - e.daysAgo)
    await prisma.fitnessLog.create({ data: { userId: user.id, date, weight: e.weight, waist: e.waist } })
  }

  // Workout logs
  const workoutEntries = [
    { daysAgo: 18, type: '💪 Síla' }, { daysAgo: 16, type: '💪 Síla' }, { daysAgo: 14, type: '🏃 Cardio' },
    { daysAgo: 11, type: '💪 Síla' }, { daysAgo: 9, type: '🧘 Sauna' }, { daysAgo: 7, type: '💪 Síla' },
    { daysAgo: 5, type: '💪 Síla' }, { daysAgo: 3, type: '🏃 Cardio' }, { daysAgo: 1, type: '💪 Síla' },
  ]
  for (const w of workoutEntries) {
    const date = new Date(); date.setDate(date.getDate() - w.daysAgo)
    await prisma.workoutLog.create({ data: { userId: user.id, date, type: w.type, duration: 60 } })
  }

  // Weekly plan
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const weekPlan = await prisma.weeklyPlan.create({
    data: { quarterId: quarter.id, weekStart, weekEnd, status: 'active' }
  })

  await prisma.weeklyTask.createMany({
    data: [
      { weeklyPlanId: weekPlan.id, goalId: goalSQL.id, title: 'Complete 5 StrataScratch SQL challenges (window functions)', effort: 3, completed: false },
      { weeklyPlanId: weekPlan.id, goalId: goalSQL.id, title: 'Study DAX CALCULATE + Time Intelligence (1h)', effort: 2, completed: true },
      { weeklyPlanId: weekPlan.id, goalId: goalPortfolio.id, title: 'Start Power BI dashboard project — connect to sample data', effort: 3, completed: false },
      { weeklyPlanId: weekPlan.id, goalId: goalFitness.id, title: '3× strength training this week', effort: 2, completed: false },
      { weeklyPlanId: weekPlan.id, goalId: goalFitness.id, title: 'Hit 150g protein daily (log in app)', effort: 1, completed: false },
    ]
  })

  // Career Capital: Skills
  await prisma.skill.createMany({
    data: [
      { userId: user.id, title: 'SQL & Advanced Analytics', category: 'technical', proficiency: 4, evidenceNotes: 'Window functions, CTEs, optimisation; used daily in work tasks', inUse: true },
      { userId: user.id, title: 'Stakeholder Communication', category: 'communication', proficiency: 3, evidenceNotes: 'Presented Q1 data review to leadership team', inUse: true },
      { userId: user.id, title: 'Python Automation', category: 'technical', proficiency: 3, evidenceNotes: 'Built automated reporting pipeline saving 4h/week', inUse: false },
      { userId: user.id, title: 'Business Process Analysis', category: 'analytical', proficiency: 3, evidenceNotes: 'Documented and improved 3 core ops workflows', inUse: true },
    ]
  })

  // Career Capital: Proof-of-Work
  await prisma.proofOfWork.createMany({
    data: [
      {
        userId: user.id,
        title: 'Automated Weekly Reporting Pipeline',
        type: 'automation',
        impact: 'Saves 4 hours/week for operations team; zero manual errors since launch',
        reusability: 5,
        monetizable: true,
        isPublic: false,
        completedAt: new Date('2026-04-15'),
      },
      {
        userId: user.id,
        title: 'Q1 Customer Churn Analysis',
        type: 'case_study',
        impact: 'Identified 3 key churn drivers; recommendations adopted by product team',
        reusability: 3,
        monetizable: false,
        isPublic: false,
        completedAt: new Date('2026-03-31'),
      },
    ]
  })

  // Career Capital: Items
  await prisma.careerCapitalItem.createMany({
    data: [
      {
        userId: user.id,
        category: 'internal',
        type: 'visibility',
        title: 'Led Q1 data review for leadership',
        impact: 'Presented insights to CxO level; recognised for analytical depth',
        date: new Date('2026-04-05'),
      },
      {
        userId: user.id,
        category: 'external',
        type: 'portfolio',
        title: 'Built internal analytics toolkit',
        impact: 'Reusable SQL + Python templates published on internal wiki',
        date: new Date('2026-04-20'),
      },
    ]
  })

  // Career Capital Goal Evals
  await prisma.careerCapitalGoalEval.create({
    data: {
      goalId: goalSQL.id,
      increasesCapital: true,
      howExactly: 'Advanced SQL is a top technical skill for senior DA roles and directly raises market value',
      newAsset: 'SQL portfolio of complex queries and documented patterns',
      reusabilityScore: 5,
      leveragePotential: 'Can be leveraged in every future analytical role; teachable to others',
      proofAttached: true,
    }
  })

  await prisma.careerCapitalGoalEval.create({
    data: {
      goalId: goalFitness.id,
      increasesCapital: false,
      howExactly: 'Fitness goal supports energy and cognitive performance but does not directly build career assets',
      newAsset: null,
      reusabilityScore: 1,
      leveragePotential: 'Indirect: better health → better focus → better work output',
      proofAttached: false,
    }
  })

  await prisma.careerCapitalGoalEval.create({
    data: {
      goalId: goalPortfolio.id,
      increasesCapital: true,
      howExactly: 'Public GitHub portfolio is a persistent, externally-verifiable proof of skills that compounds over time',
      newAsset: 'DA portfolio with SQL and Power BI projects',
      reusabilityScore: 5,
      leveragePotential: 'Shareable link in job applications, LinkedIn, recruiter outreach',
      proofAttached: true,
    }
  })

  console.log('✅ Seed complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
