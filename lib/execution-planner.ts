/**
 * ExecutionPlanner — centralized task generation service.
 *
 * All source modules produce TaskCandidates and pass them here.
 * This service is responsible for:
 *   - finding/creating the active WeeklyPlan
 *   - deduplicating by (weeklyPlanId, sourceModule, sourceType, sourceId)
 *   - creating WeeklyTasks
 *   - returning created/skipped counts
 *
 * Modules should NOT call prisma.weeklyTask.create() directly.
 * They should produce TaskCandidates and call planTasks().
 */

import { prisma } from './db'
import { ensureQuarterStatuses, getWeekBounds } from './quarters'

// ─── TaskCandidate ────────────────────────────────────────────────────────────

export type TaskDomain =
  | 'fitness'
  | 'learning'
  | 'career'
  | 'finance'
  | 'nutrition'
  | 'system'
  | 'personal'

export type TaskType =
  | 'workout'
  | 'study'
  | 'project'
  | 'admin'
  | 'review'
  | 'habit'
  | 'recovery'
  | 'finance_review'
  | 'outreach'
  | 'writing'
  | 'analysis'
  | 'other'

export type TaskPriority = 'must' | 'should' | 'optional'
export type TaskEffort   = 'low'   | 'medium' | 'deep'
export type TaskCreatedBy = 'user' | 'ai' | 'system'

export interface TaskCandidate {
  title: string
  description?: string
  domain?: TaskDomain
  taskType?: TaskType
  priority: TaskPriority
  effort: TaskEffort
  estimatedMinutes?: number
  scheduledDate?: Date
  dueDate?: Date
  doneCriteria?: string
  // Source linking
  sourceModule: string  // goal | learning | fitness | career | report | manual
  sourceType: string    // learning_step | fitness_schedule_item | career_gap_action | report_recommendation | goal_milestone | manual_task
  sourceId?: string     // ID of the originating entity
  linkedGoalId?: string
  createdBy: TaskCreatedBy
}

// ─── Priority / effort maps ───────────────────────────────────────────────────

const PRIORITY_INT: Record<TaskPriority, number> = { must: 1, should: 2, optional: 3 }
const EFFORT_INT:   Record<TaskEffort,   number> = { low: 1,  medium: 2, deep: 3 }

// ─── Result type ─────────────────────────────────────────────────────────────

export interface PlanTasksResult {
  created:  number
  skipped:  number
  planId:   string
  taskIds:  string[]
}

// ─── planTasks ────────────────────────────────────────────────────────────────

/**
 * Convert TaskCandidates into WeeklyTasks for the current active week.
 *
 * Deduplication key: (weeklyPlanId, sourceModule, sourceType, sourceId)
 * If sourceId is absent: fallback to (weeklyPlanId, sourceModule, sourceType, title)
 */
export async function planTasks(
  userId: string,
  candidates: TaskCandidate[],
): Promise<PlanTasksResult> {
  if (!candidates.length) return { created: 0, skipped: 0, planId: '', taskIds: [] }

  // ── 1. Resolve active WeeklyPlan ─────────────────────────────────────────
  await ensureQuarterStatuses(userId)
  const quarter = await prisma.quarter.findFirst({
    where: { userId, status: 'active' },
    orderBy: { startDate: 'desc' },
  })
  if (!quarter) throw new Error('No active quarter — create one at /quarterly')

  const { monday, sunday } = getWeekBounds()
  let plan = await prisma.weeklyPlan.findFirst({
    where: {
      quarterId: quarter.id,
      status: 'active',
      weekStart: { gte: monday, lte: sunday },
    },
  })
  if (!plan) {
    plan = await prisma.weeklyPlan.create({
      data: { quarterId: quarter.id, weekStart: monday, weekEnd: sunday, status: 'active' },
    })
  }

  // ── 2. Create tasks with deduplication ───────────────────────────────────
  let created = 0
  let skipped = 0
  const taskIds: string[] = []

  for (const c of candidates) {
    if (!c.title?.trim()) continue

    // Build dedup filter
    const dedupWhere = c.sourceId
      ? {
          weeklyPlanId: plan.id,
          sourceModule: c.sourceModule,
          sourceType:   c.sourceType,
          sourceId:     c.sourceId,
        }
      : {
          weeklyPlanId: plan.id,
          sourceModule: c.sourceModule,
          sourceType:   c.sourceType,
          title:        c.title,
        }

    const existing = await prisma.weeklyTask.findFirst({ where: dedupWhere })
    if (existing) {
      skipped++
      taskIds.push(existing.id)
      continue
    }

    const task = await prisma.weeklyTask.create({
      data: {
        weeklyPlanId:    plan.id,
        title:           c.title,
        description:     c.description ?? null,
        domain:          c.domain ?? null,
        taskType:        c.taskType ?? null,
        priority:        PRIORITY_INT[c.priority],
        effort:          EFFORT_INT[c.effort],
        estimatedMinutes: c.estimatedMinutes ?? null,
        scheduledDate:   c.scheduledDate ?? null,
        dueDate:         c.dueDate ?? null,
        doneCriteria:    c.doneCriteria ?? null,
        status:          'planned',
        completed:       false,
        sourceModule:    c.sourceModule,
        sourceType:      c.sourceType,
        sourceId:        c.sourceId ?? null,
        goalId:          c.linkedGoalId ?? null,
        createdBy:       c.createdBy,
      },
    })

    created++
    taskIds.push(task.id)
  }

  return { created, skipped, planId: plan.id, taskIds }
}

// ─── rolloverIncompleteTasks ──────────────────────────────────────────────────

/**
 * Carry incomplete tasks from a previous WeeklyPlan into the next one.
 *
 * Rules:
 *   priority=must (1): auto-roll if rolloverCount < 2
 *   priority=should (2): roll once (rolloverCount < 1)
 *   priority=optional (3): drop
 *   any task with rolloverCount >= limit: drop (mark as dropped)
 */
export async function rolloverIncompleteTasks(
  fromPlanId: string,
  toPlanId: string,
): Promise<{ rolled: number; dropped: number }> {
  const tasks = await prisma.weeklyTask.findMany({
    where: {
      weeklyPlanId: fromPlanId,
      completed: false,
      status: { notIn: ['done', 'dropped', 'moved'] },
    },
  })

  let rolled = 0, dropped = 0

  for (const task of tasks) {
    // Optional recurring tasks (marked by sourceType) can roll once
    const isRecurring = task.sourceType === 'recurring_task'
    const maxRollovers = task.priority === 1 ? 2 : task.priority === 2 ? 1 : isRecurring ? 1 : 0
    const shouldRoll = task.rolloverCount < maxRollovers

    if (shouldRoll) {
      // Check dedup — don't create if already exists in target plan
      const existing = task.sourceId
        ? await prisma.weeklyTask.findFirst({
            where: {
              weeklyPlanId: toPlanId,
              sourceModule: task.sourceModule,
              sourceType: task.sourceType,
              sourceId: task.sourceId,
            },
          })
        : await prisma.weeklyTask.findFirst({
            where: {
              weeklyPlanId: toPlanId,
              sourceModule: task.sourceModule,
              sourceType: task.sourceType,
              title: task.title,
            },
          })

      if (!existing) {
        await prisma.weeklyTask.create({
          data: {
            weeklyPlanId:        toPlanId,
            title:               task.title,
            description:         task.description,
            domain:              task.domain,
            taskType:            task.taskType,
            priority:            task.priority,
            effort:              task.effort,
            estimatedMinutes:    task.estimatedMinutes,
            doneCriteria:        task.doneCriteria,
            status:              'planned',
            completed:           false,
            sourceModule:        task.sourceModule,
            sourceType:          task.sourceType,
            sourceId:            task.sourceId,
            goalId:              task.goalId,
            createdBy:           task.createdBy,
            rolloverCount:       task.rolloverCount + 1,
            rolledFromTaskId:    task.id,
            originalWeekPlanId:  task.originalWeekPlanId ?? fromPlanId,
          },
        })
        rolled++
      }

      await prisma.weeklyTask.update({
        where: { id: task.id },
        data: { status: 'moved' },
      })
    } else {
      await prisma.weeklyTask.update({
        where: { id: task.id },
        data: { status: 'dropped' },
      })
      dropped++
    }
  }

  return { rolled, dropped }
}

// ─── syncSourceCompletion ─────────────────────────────────────────────────────

/**
 * When a WeeklyTask is toggled, sync completion back to the source entity.
 * Called from PATCH /api/tasks/[id].
 */
export async function syncSourceCompletion(
  taskId: string,
  completed: boolean,
): Promise<void> {
  const task = await prisma.weeklyTask.findUnique({
    where: { id: taskId },
    select: { sourceModule: true, sourceType: true, sourceId: true },
  })
  if (!task?.sourceId) return

  const completedAt = completed ? new Date() : null

  switch (task.sourceType) {
    case 'learning_step':
      await prisma.learningStep.updateMany({
        where: { id: task.sourceId },
        data: { completed, completedAt },
      }).catch(() => {})
      break

    case 'career_gap_action':
      await prisma.trajectoryGapAction.updateMany({
        where: { id: task.sourceId },
        data: { status: completed ? 'completed' : 'planned', completedAt },
      }).catch(() => {})
      break

    case 'report_recommendation':
      if (completed) {
        await prisma.reportRecommendation.updateMany({
          where: { id: task.sourceId },
          data: { status: 'completed' },
        }).catch(() => {})
      }
      break

    case 'work_item':
      if (completed) {
        await prisma.workItem.updateMany({
          where: { id: task.sourceId },
          data: { completedAt: new Date() },
        }).catch(() => {})
      }
      break

    // fitness_schedule_item: synced via FitnessScheduleChange, not here
  }
}
