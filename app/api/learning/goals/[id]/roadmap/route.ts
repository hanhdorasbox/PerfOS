import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

/** Ensure all learning-related schema columns + LearningStep table exist before querying. */
async function ensureLearningSchema() {
  const steps = [
    `ALTER TABLE "CapabilityGoal"
       ADD COLUMN IF NOT EXISTS "roadmapType"       TEXT,
       ADD COLUMN IF NOT EXISTS "deadline"           TIMESTAMP(3),
       ADD COLUMN IF NOT EXISTS "weeklyHours"        DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS "detailLevel"        TEXT NOT NULL DEFAULT 'standard',
       ADD COLUMN IF NOT EXISTS "healthStatus"       TEXT NOT NULL DEFAULT 'not_started',
       ADD COLUMN IF NOT EXISTS "nextBestAction"     TEXT,
       ADD COLUMN IF NOT EXISTS "strategicRoadmap"   TEXT,
       ADD COLUMN IF NOT EXISTS "capitalPotential"   TEXT,
       ADD COLUMN IF NOT EXISTS "archivedAt"         TIMESTAMP(3),
       ADD COLUMN IF NOT EXISTS "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
    `ALTER TABLE "LearningMilestone"
       ADD COLUMN IF NOT EXISTS "phaseName"      TEXT,
       ADD COLUMN IF NOT EXISTS "order"          INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "description"    TEXT,
       ADD COLUMN IF NOT EXISTS "estimatedHours" DOUBLE PRECISION`,
    `CREATE TABLE IF NOT EXISTS "LearningStep" (
       "id"                 TEXT    NOT NULL,
       "milestoneId"        TEXT    NOT NULL,
       "title"              TEXT    NOT NULL,
       "description"        TEXT,
       "order"              INTEGER NOT NULL DEFAULT 0,
       "estimatedMinutes"   INTEGER NOT NULL DEFAULT 30,
       "completionCriteria" TEXT,
       "stepType"           TEXT    NOT NULL DEFAULT 'practice',
       "completed"          BOOLEAN NOT NULL DEFAULT false,
       "completedAt"        TIMESTAMP(3),
       "weeklyTaskId"       TEXT,
       "suggestedDay"       TEXT,
       CONSTRAINT "LearningStep_pkey" PRIMARY KEY ("id")
     )`,
  ]
  for (const sql of steps) {
    try { await prisma.$executeRawUnsafe(sql) } catch { /* already migrated or SQLite — skip */ }
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await ensureLearningSchema()

    const goal = await prisma.capabilityGoal.findUnique({
      where: { id },
      include: { milestones: true },
    })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const isEli5 = goal.detailLevel === 'eli5'
    const levelGap = goal.targetLevel - goal.startingLevel
    const weeklyHours = goal.weeklyHours ?? 5

    const systemPrompt = isEli5
      ? `You are a learning coach who creates extremely concrete, actionable learning plans. Every step must be so specific that a beginner can start immediately. Steps 15-45 minutes each. Nothing vague. Split anything over 60 min.`
      : `You are a learning strategist who creates practical, outcome-focused roadmaps. Strategic phases give the big picture; execution steps are specific and 20-60 minutes each.`

    const prompt = `Create a complete learning roadmap for this goal.

Goal: ${goal.title}
Capability: ${goal.capabilityStatement}
Starting level: ${goal.startingLevel}/5 → Target: ${goal.targetLevel}/5
Weekly hours: ${weeklyHours}h/week
Final output: ${goal.finalOutput || 'Not specified'}
Evidence of mastery: ${goal.evidenceOfMastery || 'Not specified'}
${goal.whyItMatters ? `Why it matters: ${goal.whyItMatters}` : ''}

Requirements:
- Strategic roadmap: 3-${Math.min(6, levelGap + 3)} phases, each with timeline, milestones list, weekly tasks, resources, deliverable, success look
- Execution plan: ${Math.min(5, Math.max(3, levelGap + 2))} milestones ordered foundational → advanced; at least 2 must be type "output"
- Each execution milestone has 3 concrete steps (${isEli5 ? '15-45 min each, name exact resources' : '20-60 min each, clear completion criteria'})
- phaseName groups milestones into phases matching the strategic roadmap
- capitalPotential: assess honestly (high = creates reusable proof/portfolio/skill others can verify; medium = improves skill but limited external proof; low = internal knowledge only)
- capitalOutputs: list what career capital this learning can produce (max 4 items, be specific)`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      tools: [{
        name: 'create_full_roadmap',
        description: 'Create both the strategic roadmap (phases overview) and execution plan (milestones + steps)',
        input_schema: {
          type: 'object' as const,
          properties: {
            strategicRoadmap: {
              type: 'object',
              properties: {
                title:            { type: 'string', description: 'Short punchy roadmap title' },
                summary:          { type: 'string', description: '2-3 sentence strategic overview' },
                capitalPotential: { type: 'string', enum: ['high', 'medium', 'low'] },
                capitalOutputs:   { type: 'array', items: { type: 'string' }, description: 'Specific career capital items this learning can produce' },
                phases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name:         { type: 'string', description: 'e.g. Phase 1: SQL Foundations' },
                      timeline:     { type: 'string', description: 'e.g. Week 1-3' },
                      phasePurpose: { type: 'string', description: 'What this phase achieves (1-2 sentences)' },
                      milestones:   { type: 'array', items: { type: 'string' }, description: 'High-level milestone descriptions for this phase' },
                      weeklyTasks:  { type: 'array', items: { type: 'string' }, description: '3-4 representative weekly tasks' },
                      resources:    { type: 'array', items: { type: 'string' }, description: '2-3 specific resources (name + what for)' },
                      deliverable:  { type: 'string', description: 'Tangible output of this phase' },
                      successLook:  { type: 'string', description: 'What "done" looks like for this phase' },
                    },
                    required: ['name', 'timeline', 'phasePurpose', 'milestones', 'weeklyTasks', 'resources'],
                  },
                },
              },
              required: ['title', 'summary', 'capitalPotential', 'capitalOutputs', 'phases'],
            },
            milestones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title:          { type: 'string' },
                  type:           { type: 'string', enum: ['knowledge', 'practice', 'output'] },
                  phaseName:      { type: 'string', description: 'Must match a phase name from strategicRoadmap.phases' },
                  order:          { type: 'number' },
                  description:    { type: 'string', description: 'One sentence' },
                  estimatedHours: { type: 'number' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title:              { type: 'string' },
                        description:        { type: 'string' },
                        order:              { type: 'number' },
                        estimatedMinutes:   { type: 'number' },
                        completionCriteria: { type: 'string' },
                        stepType:           { type: 'string', enum: ['read', 'watch', 'practice', 'build', 'reflect', 'exercise'] },
                        suggestedDay:       { type: 'string' },
                      },
                      required: ['title', 'stepType'],
                    },
                  },
                },
                required: ['title', 'type', 'steps'],
              },
            },
          },
          required: ['strategicRoadmap', 'milestones'],
        },
      }],
      tool_choice: { type: 'tool', name: 'create_full_roadmap' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolBlock = response.content.find(c => c.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('AI returned no structured data — try again')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = toolBlock.input as { strategicRoadmap: any; milestones: any[] }

    const { strategicRoadmap, milestones = [] } = parsed

    // Ensure at least 1 output milestone
    const outputCount = milestones.filter((m: { type: string }) => m.type === 'output').length
    if (outputCount === 0) {
      milestones.push({
        title: `Build Final Output: ${goal.finalOutput || goal.capabilityStatement}`,
        type: 'output',
        phaseName: strategicRoadmap?.phases?.at(-1)?.name ?? `Phase ${milestones.length + 1}: Final Output`,
        order: milestones.length,
        description: 'Produce the tangible evidence of mastery for this capability.',
        estimatedHours: 4,
        steps: [{
          title: `Create ${goal.finalOutput || 'your final deliverable'}`,
          description: `Apply everything learned to produce ${goal.finalOutput || 'your final output'}`,
          order: 0,
          estimatedMinutes: 120,
          completionCriteria: `You have a complete, shareable ${goal.finalOutput || 'artifact'} that demonstrates your capability.`,
          stepType: 'build',
        }],
      })
    }

    // Delete existing milestones + steps
    const existingMilestones = await prisma.learningMilestone.findMany({ where: { capabilityGoalId: id } })
    if (existingMilestones.length > 0) {
      await prisma.learningStep.deleteMany({ where: { milestoneId: { in: existingMilestones.map(m => m.id) } } })
      await prisma.learningMilestone.deleteMany({ where: { capabilityGoalId: id } })
    }

    // Create milestones + steps
    for (const [mIdx, m] of milestones.entries()) {
      const milestone = await prisma.learningMilestone.create({
        data: {
          capabilityGoalId: id,
          title: m.title,
          type: m.type || 'knowledge',
          phaseName: m.phaseName ?? null,
          order: m.order ?? mIdx,
          description: m.description ?? null,
          estimatedHours: m.estimatedHours ?? null,
        },
      })
      if (m.steps?.length > 0) {
        await prisma.learningStep.createMany({
          data: m.steps.map((s: { title: string; description?: string; order?: number; estimatedMinutes?: number; completionCriteria?: string; stepType?: string; suggestedDay?: string }, sIdx: number) => ({
            milestoneId: milestone.id,
            title: s.title,
            description: s.description ?? null,
            order: s.order ?? sIdx,
            estimatedMinutes: s.estimatedMinutes ?? 30,
            completionCriteria: s.completionCriteria ?? null,
            stepType: s.stepType ?? 'practice',
            suggestedDay: s.suggestedDay ?? null,
          })),
        })
      }
    }

    // Save strategic roadmap + capital info to goal
    await prisma.capabilityGoal.update({
      where: { id },
      data: {
        healthStatus: 'not_started',
        strategicRoadmap: strategicRoadmap ? JSON.stringify(strategicRoadmap) : null,
        capitalPotential: strategicRoadmap?.capitalPotential ?? null,
      },
    })

    return NextResponse.json({ count: milestones.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
