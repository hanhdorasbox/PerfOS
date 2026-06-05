import { prisma } from './db'
import { planTasks, syncSourceCompletion } from './execution-planner'
import type Anthropic from '@anthropic-ai/sdk'

// ─── Tool definitions for Claude tool_use ────────────────────────────────────

export const AI_TOOLS: Anthropic.Tool[] = [
  // ── Query ──────────────────────────────────────────────────────────────────
  {
    name: 'get_module_detail',
    description: 'Get detailed data from a specific module when you need more depth than the summary context provides.',
    input_schema: {
      type: 'object' as const,
      properties: {
        module: {
          type: 'string',
          enum: ['fitness_strategy', 'workout_plan', 'learning_roadmaps', 'career_gaps', 'finance_transactions', 'reports', 'recipes', 'protein_logs', 'goal_history', 'patterns'],
          description: 'Which module to query in detail',
        },
      },
      required: ['module'],
    },
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────
  {
    name: 'create_task',
    description: 'Create a new task in the current weekly plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'string', enum: ['must', 'should', 'optional'], description: 'Task priority' },
        effort: { type: 'number', description: '1=easy, 2=medium, 3=deep work' },
        goalId: { type: 'string', description: 'Optional goal ID to link to' },
        sourceModule: { type: 'string', enum: ['goal', 'learning', 'fitness', 'career_gap', 'report'], description: 'Which module this task comes from' },
        sourceId: { type: 'string', description: 'ID of the source entity (goalId, capabilityGoalId, gapId, etc.)' },
      },
      required: ['title', 'priority'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task title, priority, effort, or scheduled day.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId:        { type: 'string' },
        title:         { type: 'string' },
        priority:      { type: 'string', enum: ['must', 'should', 'optional'] },
        effort:        { type: 'number' },
        scheduledDate: { type: 'string', description: 'ISO date string e.g. "2026-06-04" to assign a specific day' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task. REQUIRES user confirmation before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        taskTitle: { type: 'string', description: 'Title for confirmation display' },
      },
      required: ['taskId', 'taskTitle'],
    },
  },

  // ── Fitness ────────────────────────────────────────────────────────────────
  {
    name: 'move_fitness_session',
    description: 'Move a session from one day to another in the weekly fitness schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        strategyId: { type: 'string' },
        sessionName: { type: 'string', description: 'Exact session name, e.g. "Lower Body A"' },
        fromDay: { type: 'string', description: 'Current day, e.g. "Friday"' },
        toDay: { type: 'string', description: 'Target day, e.g. "Sunday"' },
      },
      required: ['strategyId', 'sessionName', 'fromDay', 'toDay'],
    },
  },
  {
    name: 'log_workout',
    description: 'Log a completed workout session. Use the EXACT session name from the fitness schedule (e.g. if schedule shows "Lower Body A", use "Lower Body A"). For sauna use the exact label from schedule (e.g. "Sauna (15-20 min)").',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', description: 'Exact workout type matching the schedule session name, e.g. "Lower Body A", "Sauna (15-20 min)", "Stairmaster Cardio"' },
        date: { type: 'string', description: 'ISO date string, e.g. "2026-05-29"' },
        duration: { type: 'number', description: 'Duration in minutes' },
        notes: { type: 'string' },
      },
      required: ['type', 'date'],
    },
  },
  {
    name: 'log_body_measurement',
    description: 'Log weight and/or waist measurement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string' },
        weight: { type: 'number', description: 'Weight in kg' },
        waist: { type: 'number', description: 'Waist in cm' },
      },
      required: ['date'],
    },
  },

  // ── Nutrition ──────────────────────────────────────────────────────────────
  {
    name: 'log_protein',
    description: 'Log protein intake for today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'Protein in grams' },
        date: { type: 'string', description: 'ISO date, defaults to today' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'update_protein_target',
    description: 'Update the daily protein target.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'number', description: 'New protein target in grams' },
      },
      required: ['target'],
    },
  },

  // ── Goals ──────────────────────────────────────────────────────────────────
  {
    name: 'log_goal_progress',
    description: 'Log a progress update for a quantitative goal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goalId: { type: 'string' },
        value: { type: 'number', description: 'Current value (not delta)' },
        note: { type: 'string' },
      },
      required: ['goalId', 'value'],
    },
  },

  // ── Learning ───────────────────────────────────────────────────────────────
  {
    name: 'create_learning_task',
    description: 'Create tasks from a learning roadmap step and add them to the weekly plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        roadmapTitle: { type: 'string' },
        roadmapId:    { type: 'string', description: 'ID of the CapabilityGoal (learning roadmap) these tasks come from' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:  { type: 'string' },
              effort: { type: 'number' },
              stepId: { type: 'string', description: 'LearningStep.id — pass when known for precise deduplication' },
            },
            required: ['title'],
          },
        },
      },
      required: ['roadmapTitle', 'tasks'],
    },
  },

  // ── Patterns ───────────────────────────────────────────────────────────────
  {
    name: 'dismiss_pattern',
    description: 'Dismiss a detected behavior pattern.',
    input_schema: {
      type: 'object' as const,
      properties: {
        patternId: { type: 'string' },
      },
      required: ['patternId'],
    },
  },
]

// ─── Tools that require confirmation ─────────────────────────────────────────

export const CONFIRMATION_REQUIRED = new Set(['delete_task'])

// ─── Action handlers ──────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

export async function executeAction(
  toolName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<ActionResult> {
  try {
    switch (toolName) {

      // ── Query ──────────────────────────────────────────────────────────────
      case 'get_module_detail': {
        const module = input.module as string
        const data = await getModuleDetail(module, userId)
        return { success: true, message: `Retrieved ${module} data`, data }
      }

      // ── Tasks ──────────────────────────────────────────────────────────────
      case 'create_task': {
        const goalId       = (input.goalId       as string) ?? null
        const sourceModule = (input.sourceModule as string) ?? (goalId ? 'goal' : 'manual')
        const sourceType   = (input.sourceType   as string) ?? (goalId ? 'goal_milestone' : 'manual_task')
        const sourceId     = (input.sourceId     as string) ?? goalId ?? undefined
        const priorityStr  = (input.priority     as string) ?? 'should'
        const effortNum    = (input.effort        as number) ?? 2
        const effortLabel  = effortNum <= 1 ? 'low' : effortNum >= 3 ? 'deep' : 'medium'

        try {
          const result = await planTasks(userId, [{
            title:        input.title as string,
            domain:       (input.domain as 'fitness' | 'learning' | 'career' | 'finance' | 'nutrition' | 'system' | 'personal') ?? undefined,
            priority:     priorityStr as 'must' | 'should' | 'optional',
            effort:       effortLabel as 'low' | 'medium' | 'deep',
            sourceModule,
            sourceType,
            sourceId,
            linkedGoalId: goalId ?? undefined,
            createdBy:    'ai',
          }])
          return { success: true, message: `Task created: "${input.title}"`, data: { taskId: result.taskIds[0] } }
        } catch (e) {
          return { success: false, message: e instanceof Error ? e.message : 'No active weekly plan' }
        }
      }

      case 'complete_task': {
        const taskId = input.taskId as string
        const task = await prisma.weeklyTask.update({
          where: { id: taskId },
          data: { completed: true, completedAt: new Date(), status: 'done' },
        })
        // Sync source completion
        await syncSourceCompletion(taskId, true)
        return { success: true, message: `"${task.title}" marked as completed` }
      }

      case 'update_task': {
        const priorityMap: Record<string, number> = { must: 1, should: 2, optional: 3 }
        const updateData: Record<string, unknown> = {}
        if (input.title)         updateData.title         = input.title
        if (input.priority)      updateData.priority      = priorityMap[input.priority as string]
        if (input.effort)        updateData.effort        = input.effort
        if (input.scheduledDate) updateData.scheduledDate = new Date(input.scheduledDate as string)
        const task = await prisma.weeklyTask.update({
          where: { id: input.taskId as string },
          data: updateData,
        })
        return { success: true, message: `Task updated: "${task.title}"` }
      }

      case 'delete_task': {
        await prisma.weeklyTask.delete({ where: { id: input.taskId as string } })
        return { success: true, message: `Task deleted: "${input.taskTitle}"` }
      }

      // ── Fitness ────────────────────────────────────────────────────────────
      case 'move_fitness_session': {
        const strategy = await prisma.fitnessStrategy.findUnique({ where: { id: input.strategyId as string } })
        if (!strategy) return { success: false, message: 'Strategy not found' }
        const schedule: { day: string; sessions: string[] }[] = strategy.weeklySchedule ? JSON.parse(strategy.weeklySchedule) : []
        const fromDay = schedule.find(d => d.day.toLowerCase() === (input.fromDay as string).toLowerCase())
        const toDay   = schedule.find(d => d.day.toLowerCase() === (input.toDay as string).toLowerCase())
        if (!fromDay) return { success: false, message: `Day "${input.fromDay}" not found in schedule` }
        if (!toDay)   return { success: false, message: `Day "${input.toDay}" not found in schedule` }
        const sessionName = input.sessionName as string
        const idx = fromDay.sessions.findIndex(s => s.toLowerCase().includes(sessionName.toLowerCase()))
        if (idx === -1) return { success: false, message: `Session "${sessionName}" not found on ${input.fromDay}` }
        const [session] = fromDay.sessions.splice(idx, 1)
        toDay.sessions.push(session)
        await prisma.fitnessStrategy.update({
          where: { id: input.strategyId as string },
          data: { weeklySchedule: JSON.stringify(schedule) },
        })
        return { success: true, message: `"${session}" moved from ${input.fromDay} to ${input.toDay}`, data: { session, fromDay: input.fromDay, toDay: input.toDay } }
      }

      case 'log_workout': {
        const workoutDate = new Date(input.date as string)
        const w = await prisma.workoutLog.create({
          data: {
            userId,
            type: input.type as string,
            date: workoutDate,
            duration: (input.duration as number) ?? null,
            notes: (input.notes as string) ?? null,
          },
        })

        // Also create FitnessScheduleChange so it shows as done in the strategy view
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const sessionDay = dayNames[workoutDate.getDay()]
        const wDay = workoutDate.getDay()
        const wDiff = wDay === 0 ? -6 : 1 - wDay
        const mon = new Date(workoutDate)
        mon.setDate(workoutDate.getDate() + wDiff)
        const weekId = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`
        const typeLC = (input.type as string).toLowerCase()
        const sessionType = typeLC.includes('sauna') || typeLC.includes('recovery') || typeLC.includes('stretch') ? 'recovery'
          : typeLC.includes('cardio') || typeLC.includes('stairmaster') || typeLC.includes('run') || typeLC.includes('bike') || typeLC.includes('swim') ? 'cardio'
          : 'strength'
        await prisma.fitnessScheduleChange.create({
          data: { userId, weekId, sessionLabel: input.type as string, sessionDay, sessionType, action: 'completed', notes: (input.notes as string) ?? null },
        }).catch(() => {})

        // Auto-complete matching fitness weekly task
        const plan = await prisma.weeklyPlan.findFirst({
          where: { userId, status: 'active' },
          include: { tasks: { where: { completed: false, sourceModule: 'fitness' }, select: { id: true, title: true } } },
          orderBy: { weekStart: 'desc' },
        })
        if (plan?.tasks.length) {
          const words = typeLC.split(/\s+/).filter(w => w.length > 3)
          const match = plan.tasks.find(t => t.title.toLowerCase() === typeLC)
            ?? plan.tasks.find(t => typeLC.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(typeLC))
            ?? plan.tasks.find(t => words.some(w => t.title.toLowerCase().includes(w)))
          if (match) {
            await prisma.weeklyTask.update({ where: { id: match.id }, data: { completed: true, completedAt: new Date(), status: 'done' } }).catch(() => {})
          }
        }

        return { success: true, message: `Workout logged: ${input.type} on ${input.date}`, data: { workoutId: w.id } }
      }

      case 'log_body_measurement': {
        const log = await prisma.fitnessLog.create({
          data: {
            userId,
            date: new Date(input.date as string),
            weight: (input.weight as number) ?? null,
            waist: (input.waist as number) ?? null,
          },
        })
        return { success: true, message: `Measurement logged: ${input.weight ? `${input.weight}kg` : ''} ${input.waist ? `waist ${input.waist}cm` : ''}`.trim(), data: { logId: log.id } }
      }

      // ── Nutrition ──────────────────────────────────────────────────────────
      case 'log_protein': {
        const date = input.date ? new Date(input.date as string) : new Date()
        const existing = await prisma.proteinLog.findFirst({
          where: { userId, date: { gte: new Date(date.setHours(0, 0, 0, 0)) } },
        })
        if (existing) {
          await prisma.proteinLog.update({
            where: { id: existing.id },
            data: { amount: input.amount as number },
          })
        } else {
          await prisma.proteinLog.create({
            data: { userId, amount: input.amount as number, date: new Date(), target: 120 },
          })
        }
        return { success: true, message: `Protein logged: ${input.amount}g` }
      }

      case 'update_protein_target': {
        const target = input.target as number
        // Update in latest protein log's target field
        const latestLog = await prisma.proteinLog.findFirst({ where: { userId }, orderBy: { date: 'desc' } })
        if (latestLog) {
          await prisma.proteinLog.updateMany({ where: { userId }, data: { target } })
        }
        // Also update fitness strategy nutritionDir
        const strategy = await prisma.fitnessStrategy.findFirst({
          where: { userId, status: { in: ['active', 'draft'] } },
          orderBy: { createdAt: 'desc' },
        })
        if (strategy?.nutritionDir) {
          try {
            const nd = JSON.parse(strategy.nutritionDir)
            nd.proteinTarget = target
            await prisma.fitnessStrategy.update({
              where: { id: strategy.id },
              data: { nutritionDir: JSON.stringify(nd) },
            })
          } catch { /* ignore */ }
        }
        return { success: true, message: `Protein target updated to ${target}g/day` }
      }

      // ── Goals ──────────────────────────────────────────────────────────────
      case 'log_goal_progress': {
        const update = await prisma.progressUpdate.create({
          data: {
            goalId: input.goalId as string,
            value: input.value as number,
            note: (input.note as string) ?? null,
          },
        })
        await prisma.goal.update({
          where: { id: input.goalId as string },
          data: { currentValue: input.value as number },
        })
        return { success: true, message: `Progress logged: ${input.value}`, data: { updateId: update.id } }
      }

      // ── Learning ───────────────────────────────────────────────────────────
      case 'create_learning_task': {
        const tasks     = input.tasks as { title: string; effort?: number; stepId?: string }[]
        const roadmapId = (input.roadmapId as string) ?? undefined

        try {
          const result = await planTasks(userId, tasks.map(t => ({
            title:        t.title,
            domain:       'learning' as const,
            taskType:     'study' as const,
            priority:     'should' as const,
            effort:       (t.effort ?? 2) <= 1 ? 'low' as const : (t.effort ?? 2) >= 3 ? 'deep' as const : 'medium' as const,
            sourceModule: 'learning',
            sourceType:   'learning_step',
            // Use per-step ID if known; fall back to title-based dedup (sourceId omitted)
            sourceId:     t.stepId ?? (roadmapId ? `${roadmapId}:${t.title}` : undefined),
            createdBy:    'ai' as const,
          })))
          return { success: true, message: `${result.created} learning tasks created from "${input.roadmapTitle}"`, data: { taskIds: result.taskIds } }
        } catch (e) {
          return { success: false, message: e instanceof Error ? e.message : 'No active weekly plan' }
        }
      }

      // ── Patterns ───────────────────────────────────────────────────────────
      case 'dismiss_pattern': {
        await prisma.behaviorPattern.update({
          where: { id: input.patternId as string },
          data: { active: false },
        })
        return { success: true, message: 'Pattern dismissed' }
      }

      default:
        return { success: false, message: `Unknown action: ${toolName}` }
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Deep module queries ──────────────────────────────────────────────────────

async function getModuleDetail(module: string, userId: string): Promise<unknown> {
  switch (module) {
    case 'fitness_strategy': {
      const s = await prisma.fitnessStrategy.findFirst({
        where: { userId, status: { in: ['active', 'draft'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!s) return null
      const tp = (x: string | null) => { try { return x ? JSON.parse(x) : null } catch { return null } }
      return {
        id: s.id, status: s.status, objective: s.mainObjective,
        strengthPlan: tp(s.strengthPlan), cardioPlan: tp(s.cardioPlan),
        saunaPlan: tp(s.saunaPlan), nutritionDir: tp(s.nutritionDir),
        weeklySchedule: tp(s.weeklySchedule), weeklyTargets: tp(s.weeklyTargets),
        immediateNextSteps: tp(s.immediateNextSteps),
        trackingMetrics: tp(s.trackingMetrics),
        risks: s.risks, decisionRules: s.decisionRules,
      }
    }

    case 'workout_plan': {
      const s = await prisma.fitnessStrategy.findFirst({
        where: { userId, status: { in: ['active', 'draft'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!s?.workoutPlan) return null
      return JSON.parse(s.workoutPlan)
    }

    case 'learning_roadmaps': {
      const roadmaps = await prisma.capabilityGoal.findMany({
        where: { userId },
        include: {
          milestones: {
            include: { steps: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return roadmaps.map(r => ({
        id: r.id, title: r.title, status: r.healthStatus, type: r.roadmapType,
        deadline: r.deadline?.toISOString().split('T')[0],
        milestones: r.milestones.map(m => ({
          title: m.title,
          steps: m.steps.map(s => ({ title: s.title, completed: s.completed })),
        })),
      }))
    }

    case 'career_gaps': {
      const trajectory = await prisma.careerTrajectory.findFirst({
        where: { userId, status: 'active' },
        include: { gaps: true },
        orderBy: { createdAt: 'desc' },
      })
      return trajectory?.gaps.map(g => ({
        id: g.id, area: g.title, priority: g.priority,
        nextBestAction: g.nextBestAction, difficulty: g.difficulty,
        closed: g.closed,
      })) ?? []
    }

    case 'finance_transactions': {
      const latestImport = await prisma.financeImport.findFirst({
        where: { userId }, orderBy: { createdAt: 'desc' },
      })
      if (!latestImport) return { message: 'No imports found' }
      const txs = await prisma.financeTransaction.findMany({
        where: { importId: latestImport.id },
        orderBy: { txDate: 'desc' },
        take: 30,
      })
      return txs.map(t => ({ date: t.txDate, description: t.description, amount: t.amount, category: t.category }))
    }

    case 'reports': {
      const reports = await prisma.weeklyReport.findMany({
        where: { userId }, orderBy: { weekStart: 'desc' }, take: 3,
      })
      return reports.map(r => ({
        week: r.weekStart.toISOString().split('T')[0],
        status: r.status, summary: r.chiefOfStaffMsg ?? r.executiveSummary,
      }))
    }

    case 'protein_logs': {
      const logs = await prisma.proteinLog.findMany({
        where: { userId }, orderBy: { date: 'desc' }, take: 14,
      })
      return logs.map(l => ({ date: l.date.toISOString().split('T')[0], amount: l.amount, target: l.target }))
    }

    case 'goal_history': {
      const goals = await prisma.goal.findMany({
        where: { userId },
        include: { progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 5 } },
        orderBy: { createdAt: 'desc' }, take: 10,
      })
      return goals.map(g => ({
        id: g.id, title: g.title, currentValue: g.currentValue,
        targetValue: g.targetValue, unit: g.unit,
        recentUpdates: g.progressUpdates.map(u => ({ date: u.loggedAt.toISOString().split('T')[0], value: u.value, note: u.note })),
      }))
    }

    case 'patterns': {
      const patterns = await prisma.behaviorPattern.findMany({
        where: { userId }, orderBy: { updatedAt: 'desc' },
      })
      return patterns.map(p => ({ id: p.id, domain: p.domain, pattern: p.pattern, active: p.active, implication: p.implication }))
    }

    case 'recipes': {
      const recipes = await prisma.recipe.findMany({
        where: { userId }, include: { ingredients: true }, orderBy: { createdAt: 'desc' }, take: 10,
      })
      return recipes.map(r => ({
        id: r.id, name: r.name, protein: r.totalProtein,
        calories: r.totalCalories, portions: r.portions,
        tags: r.tags,
      }))
    }

    default:
      return { error: `Unknown module: ${module}` }
  }
}
