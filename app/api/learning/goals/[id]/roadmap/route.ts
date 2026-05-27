import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { jsonrepair } from 'jsonrepair'

const client = createAnthropicClient()

/** Ensure all learning-related schema columns + LearningStep table exist before querying. */
async function ensureLearningSchema() {
  const steps = [
    `ALTER TABLE "CapabilityGoal"
       ADD COLUMN IF NOT EXISTS "roadmapType"    TEXT,
       ADD COLUMN IF NOT EXISTS "deadline"       TIMESTAMP(3),
       ADD COLUMN IF NOT EXISTS "weeklyHours"    DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS "detailLevel"    TEXT NOT NULL DEFAULT 'standard',
       ADD COLUMN IF NOT EXISTS "healthStatus"   TEXT NOT NULL DEFAULT 'not_started',
       ADD COLUMN IF NOT EXISTS "nextBestAction" TEXT,
       ADD COLUMN IF NOT EXISTS "archivedAt"     TIMESTAMP(3),
       ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
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
    // Apply any missing schema changes before querying (idempotent)
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
      ? `You are a learning coach who creates extremely concrete, actionable learning plans. Every step must be so specific that a beginner can start immediately without googling anything extra. Steps must be 15-45 minutes each. Nothing vague. If a task would take more than 60 minutes, split it.`
      : `You are a learning strategist who creates practical, outcome-focused roadmaps. Steps must be specific and actionable, 20-60 minutes each. Focus on building real capability, not just consuming content.`

    const prompt = `Create a learning roadmap for this goal. Output ONLY a JSON object — no markdown, no explanation, no code fences.

Goal: ${goal.title}
Capability: ${goal.capabilityStatement}
Starting level: ${goal.startingLevel}/5 → Target: ${goal.targetLevel}/5
Weekly hours: ${weeklyHours}h/week
Final output: ${goal.finalOutput || 'Not specified'}
Detail level: ${isEli5 ? 'ELI5 (very concrete, beginner)' : 'Standard'}

REQUIRED JSON FORMAT (copy this structure exactly):
{"milestones":[{"title":"string","type":"knowledge","phaseName":"Phase 1: Foundations","order":0,"description":"string","estimatedHours":4,"steps":[{"title":"string","description":"string","order":0,"estimatedMinutes":30,"completionCriteria":"string","stepType":"read","suggestedDay":"Monday"}]}]}

STRICT RULES — violating these will break the app:
1. Output ONLY the JSON object. Nothing before or after it.
2. Every object in an array MUST be separated by a comma: [{...},{...},{...}]
3. Never omit commas between array items.
4. No trailing commas: [a,b,c] not [a,b,c,]
5. All string values must use straight double quotes. No special characters.
6. Keep ALL string values under 120 characters. Short and specific.

CONTENT RULES:
- Exactly ${Math.min(5, Math.max(3, levelGap + 2))} milestones total
- At least 2 milestones must have type "output" (tangible deliverable)
- Each milestone has exactly 3 steps (no more, no less)
- type values: "knowledge", "practice", or "output"
- stepType values: "read", "watch", "practice", "build", "reflect", "exercise"
- phaseName: "Phase 1: Foundations", "Phase 2: Core Skills", "Phase 3: Application", etc.
- ${isEli5 ? 'Name exact resources in step descriptions (e.g., specific YouTube channels, exact exercise names)' : 'Make steps specific with clear actions and completion criteria'}
- estimatedHours per milestone realistic for weeklyHours=${weeklyHours}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,   // bumped: full roadmap JSON (4-8 milestones × 2-5 steps) easily exceeds 4096
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract the JSON object from the response (strips any accidental prefix/suffix text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI returned no JSON — try again')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: { milestones?: any[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      // jsonrepair handles: missing commas, trailing commas, unquoted keys, etc.
      try {
        parsed = JSON.parse(jsonrepair(jsonMatch[0]))
      } catch (repairErr) {
        throw new Error(`JSON parse failed: ${repairErr instanceof Error ? repairErr.message : repairErr}`)
      }
    }

    const milestones: Array<{
      title: string; type: string; phaseName?: string; order?: number;
      description?: string; estimatedHours?: number;
      steps?: Array<{
        title: string; description?: string; order?: number;
        estimatedMinutes?: number; completionCriteria?: string;
        stepType?: string; suggestedDay?: string;
      }>
    }> = parsed.milestones || []

    // Ensure at least 2 output milestones
    const outputCount = milestones.filter(m => m.type === 'output').length
    if (outputCount === 0) {
      milestones.push({
        title: `Build Final Output: ${goal.finalOutput || goal.capabilityStatement}`,
        type: 'output',
        phaseName: `Phase ${milestones.length + 1}: Final Output`,
        order: milestones.length,
        description: 'Produce the tangible evidence of mastery for this capability.',
        estimatedHours: 4,
        steps: [
          {
            title: `Create ${goal.finalOutput || 'your final deliverable'}`,
            description: `Apply everything learned to produce ${goal.finalOutput || 'your final output'}`,
            order: 0,
            estimatedMinutes: 120,
            completionCriteria: `You have a complete, shareable ${goal.finalOutput || 'artifact'} that demonstrates your capability.`,
            stepType: 'build',
          },
        ],
      })
    }

    // Delete existing milestones+steps if regenerating
    const existingMilestones = await prisma.learningMilestone.findMany({ where: { capabilityGoalId: id } })
    if (existingMilestones.length > 0) {
      await prisma.learningStep.deleteMany({ where: { milestoneId: { in: existingMilestones.map(m => m.id) } } })
      await prisma.learningMilestone.deleteMany({ where: { capabilityGoalId: id } })
    }

    // Create milestones and steps
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

      if (m.steps && m.steps.length > 0) {
        await prisma.learningStep.createMany({
          data: m.steps.map((s, sIdx) => ({
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

    // Update health status to not_started since roadmap is fresh
    await prisma.capabilityGoal.update({
      where: { id },
      data: { healthStatus: 'not_started' },
    })

    return NextResponse.json({ count: milestones.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
