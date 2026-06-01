import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { AI_TOOLS, CONFIRMATION_REQUIRED, executeAction } from '@/lib/ai-tools'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress, getQuarterProgress } from '@/lib/calculations'
import Anthropic from '@anthropic-ai/sdk'

const client = createAnthropicClient()

// ─── Compact context builder ──────────────────────────────────────────────────

async function buildContextSummary(userId: string): Promise<string> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [quarter, fitnessStrategy, recentLogs, weekAlcohol, patterns, learningRoadmaps, careerTrajectory, proteinToday, financeImport] = await Promise.all([
    prisma.quarter.findFirst({
      where: { userId, status: 'active' },
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
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId, status: { in: ['active', 'draft'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fitnessLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 1 }),
    prisma.alcoholLog.aggregate({
      where: { userId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _sum: { drinks: true },
    }),
    prisma.behaviorPattern.findMany({ where: { userId, active: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    prisma.capabilityGoal.findMany({
      where: { userId, status: { in: ['active', 'not_started'] } },
      include: { milestones: { include: { steps: true }, orderBy: { order: 'asc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.careerTrajectory.findFirst({
      where: { userId, status: 'active' },
      include: { gaps: { where: { closed: false }, take: 3 } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.proteinLog.findFirst({
      where: { userId, date: { gte: today } },
      orderBy: { date: 'desc' },
    }),
    prisma.financeImport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  const tp = (x: string | null | undefined) => { try { return x ? JSON.parse(x) : null } catch { return null } }

  // ── Quarter + Goals ──────────────────────────────────────────────────────────
  const qProgressObj = quarter ? getQuarterProgress(quarter.startDate, quarter.endDate) : null
  const qProgress = qProgressObj?.pct ?? 0

  const goalsText = quarter?.goals.map(g => {
    let pct = 0
    if (g.trackingType === 'QUANTITATIVE' && g.startValue != null && g.targetValue != null && g.currentValue != null) {
      pct = calcQuantitativeProgress(g.startValue, g.currentValue, g.targetValue)
    } else if (g.trackingType === 'MILESTONE') {
      pct = calcMilestoneProgress(g.milestones)
    }
    const m = calcGoalMetrics({
      startDate: quarter!.startDate,
      deadline: g.deadline,
      progressPct: pct,
      progressHistory: g.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
    })
    return `  - [id:${g.id}] "${g.title}" (${g.category}): ${Math.round(pct)}% done, expected ${Math.round(m.expectedPct)}%, gap ${Math.round(m.gap)}% → ${m.statusLabel}, deadline ${g.deadline.toISOString().split('T')[0]}`
  }).join('\n') ?? '  (none)'

  // ── Tasks ────────────────────────────────────────────────────────────────────
  const weekPlan = quarter?.weeklyPlans[0]
  const tasks = weekPlan?.tasks ?? []
  const must = tasks.filter(t => !t.completed && t.priority === 1)
  const should = tasks.filter(t => !t.completed && t.priority === 2)
  const optional = tasks.filter(t => !t.completed && t.priority === 3)
  const completedTasks = tasks.filter(t => t.completed)

  const taskLine = (t: typeof tasks[0]) => `[id:${t.id}] "${t.title}"`

  // ── Fitness ──────────────────────────────────────────────────────────────────
  const schedule: { day: string; sessions: string[] }[] = tp(fitnessStrategy?.weeklySchedule) ?? []
  const scheduleText = schedule.map(d => `${d.day}: ${(d.sessions ?? []).join(', ') || 'rest'}`).join(' | ')
  const fsNutr = tp(fitnessStrategy?.nutritionDir)
  const latestLog = recentLogs[0]
  const alcoholSettings = await prisma.alcoholSettings.findUnique({ where: { userId } })

  // ── Fitness schedule changes this week ──────────────────────────────────────
  const weekId = (() => {
    const d = new Date(); const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day; const mon = new Date(d)
    mon.setDate(d.getDate() + diff); return mon.toISOString().split('T')[0]
  })()
  const scheduleChanges = await prisma.fitnessScheduleChange.findMany({
    where: { userId, weekId, undone: false },
  })
  const completedSessions = scheduleChanges.filter(c => c.action === 'completed').map(c => c.sessionLabel)
  const removedSessions = scheduleChanges.filter(c => c.action === 'removed').map(c => c.sessionLabel)

  // ── Learning ─────────────────────────────────────────────────────────────────
  const learningText = learningRoadmaps.map(r => {
    const total = r.milestones.reduce((s, m) => s + m.steps.length, 0)
    const done = r.milestones.reduce((s, m) => s + m.steps.filter(st => st.completed).length, 0)
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return `  - [id:${r.id}] "${r.title}": ${pct}% (${done}/${total} steps)`
  }).join('\n') || '  (none)'

  // ── Career ───────────────────────────────────────────────────────────────────
  const careerText = careerTrajectory
    ? `${careerTrajectory.currentRole} → ${careerTrajectory.targetRoleTitle ?? careerTrajectory.targetPath} | readiness ${careerTrajectory.readinessScore ?? '?'}% | ${(careerTrajectory as typeof careerTrajectory & { gaps: { title: string }[] }).gaps.length} open gap(s): ${(careerTrajectory as typeof careerTrajectory & { gaps: { title: string }[] }).gaps.map(g => g.title).join(', ')}`
    : '(no career trajectory set)'

  // ── Patterns ─────────────────────────────────────────────────────────────────
  const patternsText = patterns.map(p => `  - [id:${p.id}] ${p.domain}: ${p.pattern}`).join('\n') || '  (none)'

  return `### Quarter: ${quarter?.name ?? 'No active quarter'}
Quarter time progress: ${Math.round(qProgress)}%

### Goals:
${goalsText}

### This Week's Tasks:
Weekly plan ID: ${weekPlan?.id ?? 'none'} | Week of: ${weekPlan?.weekStart?.toISOString().split('T')[0] ?? '?'}
MUST (${must.length} remaining): ${must.map(taskLine).join(', ') || 'none'}
SHOULD (${should.length} remaining): ${should.map(taskLine).join(', ') || 'none'}
OPTIONAL (${optional.length}): ${optional.map(taskLine).join(', ') || 'none'}
Completed: ${completedTasks.length}/${tasks.length}

### Fitness:
Strategy ID: ${fitnessStrategy?.id ?? 'none'} | Status: ${fitnessStrategy?.status ?? 'none'}
Objective: ${fitnessStrategy?.mainObjective ?? 'No strategy'}
Schedule: ${scheduleText || 'not set'}
This week — completed sessions: ${completedSessions.join(', ') || 'none'} | removed: ${removedSessions.join(', ') || 'none'}
Last measurement: ${latestLog ? `${latestLog.date.toISOString().split('T')[0]} — ${latestLog.weight ?? '?'}kg, waist ${latestLog.waist ?? '?'}cm` : 'none'}
Protein target: ${proteinToday?.target ?? fsNutr?.proteinTarget ?? '?'}g | today: ${proteinToday?.amount ?? 0}g

### Career: ${careerText}

### Learning Roadmaps:
${learningText}

### Behavior Patterns:
${patternsText}

### Habits:
Alcohol this week: ${weekAlcohol._sum.drinks ?? 0} drinks${alcoholSettings?.weeklyBudget ? ` / ${alcoholSettings.weeklyBudget} budget` : ''} | goal: ${alcoholSettings?.goal ?? '?'}

### Finance:
Latest import: ${financeImport ? `${financeImport.statementMonth} (${financeImport.createdAt.toISOString().split('T')[0]})` : 'no import yet'}`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      messages: clientMessages,
      confirm,
    } = body as {
      messages: ChatMessage[]
      confirm?: { toolName: string; input: Record<string, unknown> }
    }

    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

    // ── Confirmed destructive action ─────────────────────────────────────────
    if (confirm) {
      const result = await executeAction(confirm.toolName, confirm.input, user.id)
      return NextResponse.json({ confirmationExecuted: true, actionResult: result })
    }

    // ── Build system prompt ──────────────────────────────────────────────────
    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const contextSummary = await buildContextSummary(user.id)

    const systemPrompt = `You are an AI Chief of Staff for a high-performance individual. You have real-time access to their entire life dashboard.

Today: ${todayStr}

## Live Dashboard Data
${contextSummary}

## How to respond
- Be concise and ADHD-friendly: bullets over paragraphs, bold key numbers
- Reference specific data: goal names, task IDs, exact numbers and dates
- Flag risks proactively (e.g. if a goal is behind, say so unprompted)
- For deeper data not in the summary above, use the get_module_detail tool
- Respond in the user's language (Czech or English — match what they write)

## Actions
Use tools when the user asks you to do something. Available: create/complete/update/delete tasks, log workouts, log measurements, log protein, move fitness sessions, log goal progress, dismiss patterns.
For delete operations: always describe what you'll delete and ask for confirmation — never delete without the user confirming in their next message.`

    // ── Agentic loop ─────────────────────────────────────────────────────────
    const loopMessages: Anthropic.MessageParam[] = clientMessages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    let finalAnswer = ''
    const actionResults: { toolName: string; result: { success: boolean; message: string; data?: unknown } }[] = []

    for (let iteration = 0; iteration < 8; iteration++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        tools: AI_TOOLS,
        messages: loopMessages,
      })

      // Collect text blocks
      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
      if (textBlocks.length > 0) {
        finalAnswer = textBlocks.join('\n')
      }

      if (response.stop_reason === 'end_turn') break

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

        // Add assistant turn with tool calls
        loopMessages.push({ role: 'assistant', content: response.content })

        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const toolUse of toolUseBlocks) {
          const toolInput = toolUse.input as Record<string, unknown>

          // Confirmation required — return early so the UI can ask
          if (CONFIRMATION_REQUIRED.has(toolUse.name)) {
            const preview =
              toolUse.name === 'delete_task'
                ? `Delete task: "${toolInput.taskTitle ?? toolInput.taskId}"`
                : `Execute: ${toolUse.name}`

            return NextResponse.json({
              answer: finalAnswer || 'I need your confirmation before proceeding.',
              confirmationRequired: {
                toolName: toolUse.name,
                input: toolInput,
                preview,
              },
            })
          }

          const result = await executeAction(toolUse.name, toolInput, user.id)
          actionResults.push({ toolName: toolUse.name, result })

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          })
        }

        loopMessages.push({ role: 'user', content: toolResults })
        continue
      }

      break
    }

    return NextResponse.json({
      answer: finalAnswer,
      actionResults: actionResults.length > 0 ? actionResults : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
