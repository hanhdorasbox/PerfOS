import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress } from '@/lib/calculations'

const client = createAnthropicClient()

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  const todayStr = new Date().toISOString().split('T')[0]
  await prisma.dailyBriefing.deleteMany({ where: { userId, date: todayStr } })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any
  const { userId } = await req.json()

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const todayStr = new Date().toISOString().split('T')[0]

  // Fetch all context
  const quarter = await prisma.quarter.findFirst({
    where: { userId, status: 'active' },
    include: {
      goals: {
        include: {
          milestones: true,
          progressUpdates: { orderBy: { loggedAt: 'asc' }, take: 50 },
          weeklyTasks: { include: { goal: true } },
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

  const goalsWithMetrics = quarter?.goals.map((goal) => {
    let progressPct = 0
    if (goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null && goal.currentValue != null) {
      progressPct = calcQuantitativeProgress(goal.startValue, goal.currentValue, goal.targetValue)
    } else if (goal.trackingType === 'MILESTONE') {
      progressPct = calcMilestoneProgress(goal.milestones)
    }

    const metrics = calcGoalMetrics({
      startDate: quarter.startDate,
      deadline: goal.deadline,
      progressPct,
      progressHistory: goal.progressUpdates.map((u) => ({ loggedAt: u.loggedAt, pct: u.value })),
    })

    return { ...goal, progressPct, metrics }
  }) ?? []

  const tasks = quarter?.weeklyPlans[0]?.tasks ?? []

  // Compute current week number within the quarter (1-based)
  const weekOfQuarter = quarter
    ? Math.min(13, Math.max(1, Math.ceil((Date.now() - quarter.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1))
    : null
  const quarterTotalWeeks = quarter
    ? Math.round((quarter.endDate.getTime() - quarter.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null

  const fitnessStrategy = await prisma.fitnessStrategy.findFirst({
    where: { userId, status: { in: ['active', 'draft'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const weeklyReport = await prisma.weeklyReport.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const careerTrajectory = await prisma.careerTrajectory.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const capabilityGoals = await prisma.capabilityGoal.findMany({
    where: { userId, status: 'active' },
    take: 3,
  })

  const behaviorPatterns = await prisma.behaviorPattern.findMany({
    where: { userId, active: true },
    orderBy: { confidence: 'desc' },
    take: 8,
  })

  // Call Anthropic
  const match = (
    await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a personal chief of staff and daily intelligence briefing system. Generate two things in one JSON response:

1. A personal performance briefing based on the user's goal data
2. A world intelligence briefing — curated, high-signal, no fluff

Return ONLY valid JSON, no markdown, no extra text:

{
  "summary": "one direct sentence summarizing today's strategic situation (reference specific goals/numbers)",
  "instruction": "one concrete tactical operating instruction for today (e.g. 'Block 2h for X before 11am' — not motivational)",
  "directive": "Structured weekly directive. Format as: one framing sentence ending with a colon, then each action/conclusion on its own line starting with '• '. Use \\n between lines. Example: 'This week is about execution consistency:\\n• SQL is the critical gap — block at least 3 sessions before Friday.\\n• Protein tracking must run every day, not just training days.' Be specific, reference actual goal names and numbers. Focus on execution: training sessions completed, learning steps done, protein logged, tasks finished. Never mention waist measurement, weight tracking, body composition measurement, or baseline metrics — fitness is tracked by session adherence and consistency, not body measurements.",
  "priorities": [
    {"text": "task description", "priority": "must|should|optional", "goalTitle": "string or null", "whyToday": "brief 1-sentence reason"}
  ],
  "worldBriefing": [
    {
      "headline": "One clear sentence stating what happened",
      "why": "One phrase explaining why it matters — keep under 15 words",
      "category": "geopolitics|business|tech|society|markets"
    }
  ],
  "dailyFacts": [
    {
      "category": "psychology",
      "fact": "One practical, credible insight. Max 2 sentences.",
      "whyItMatters": "One short sentence on why this is useful right now"
    },
    {
      "category": "health",
      "fact": "One practical health/lifestyle insight. Max 2 sentences.",
      "whyItMatters": "One short sentence on why this is useful right now"
    },
    {
      "category": "fitness",
      "fact": "One practical strength/body composition insight. Max 2 sentences.",
      "whyItMatters": "One short sentence on why this is useful right now"
    }
  ],
  "externalContext": null
}

World briefing rules:
- Exactly ONE item per category — 5 categories (geopolitics, business, tech, society, markets), exactly 5 items total
- Pick the single most important story per category; include Czech/Central European news if materially relevant
- Base on your most recent knowledge; today's date is provided

Daily facts rules:
- ALWAYS return exactly 3 facts: one psychology, one health, one fitness
- Choose based on what's most relevant to the user's current situation (goals, blockers, patterns)
- Psychology topics: procrastination, motivation, focus, ADHD execution, habits, decision-making, cognitive biases
- Health topics: sleep, hydration, stress, recovery, nutrition basics, energy, hormones, alcohol impact
- Fitness topics: strength training, fat loss, protein, cardio, progressive overload, recovery, workout consistency
- Facts should be short (1-2 sentences), practical, credible, not sensationalist
- Personalize: if user is behind on protein → protein fact; alcohol logged → recovery fact; tasks skipped → procrastination fact

Behavior patterns rules:
- If behaviorPatterns is provided, use them to personalize priorities and directive
- High-confidence patterns (4-5) should directly influence task ordering and directive tone
- Reference patterns implicitly in recommendations, not by name`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            date: todayStr,
            dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            quarterName: quarter?.name,
            weekOfQuarter,
            quarterTotalWeeks,
            goals: goalsWithMetrics.map((g) => ({
              title: g.title,
              category: g.category,
              strategicRole: g.strategicRole,
              status: g.metrics.status,
              progress: Math.round(g.progressPct),
              expected: Math.round(g.metrics.expectedPct),
              gap: Math.round(g.metrics.gap),
              daysRemaining: Math.round(g.metrics.daysRemaining),
            })),
            tasks: tasks
              .filter((t) => !t.completed)
              .slice(0, 10)
              .map((t) => ({
                title: t.title,
                effort: t.effort,
                priority: t.priority,
                goalTitle: t.goal?.title ?? null,
              })),
            strategyObjective: fitnessStrategy?.mainObjective ?? null,
            careerTarget: careerTrajectory?.targetRoleTitle ?? null,
            learningAreas: capabilityGoals.map((g) => g.title),
            recentReportSummary: weeklyReport?.executiveSummary ?? null,
            behaviorPatterns: behaviorPatterns.map(p => ({
              domain: p.domain,
              pattern: p.pattern,
              implication: p.implication,
              confidence: p.confidence,
            })),
          }),
        },
      ],
    })
  ).content.find(b => b.type === 'text')?.text.match(/\{[\s\S]*\}/)

  if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })

  try {
    parsed = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'JSON parse error' }, { status: 500 })
  }

  const briefing = await prisma.dailyBriefing.upsert({
    where: { userId_date: { userId, date: todayStr } },
    create: {
      userId,
      date: todayStr,
      summary: parsed.summary,
      instruction: parsed.instruction,
      directive: parsed.directive,
      priorities: JSON.stringify(parsed.priorities ?? []),
      worldBriefing: parsed.worldBriefing ? JSON.stringify(parsed.worldBriefing) : null,
      relevantUpdates: parsed.relevantUpdates ? JSON.stringify(parsed.relevantUpdates) : null,
      externalContext: null,
      dailyFacts: parsed.dailyFacts ? JSON.stringify(parsed.dailyFacts) : null,
    },
    update: {
      summary: parsed.summary,
      instruction: parsed.instruction,
      directive: parsed.directive,
      priorities: JSON.stringify(parsed.priorities ?? []),
      worldBriefing: parsed.worldBriefing ? JSON.stringify(parsed.worldBriefing) : null,
      relevantUpdates: parsed.relevantUpdates ? JSON.stringify(parsed.relevantUpdates) : null,
      externalContext: null,
      dailyFacts: parsed.dailyFacts ? JSON.stringify(parsed.dailyFacts) : null,
      generatedAt: new Date(),
    },
  })

  return NextResponse.json(briefing)
}
