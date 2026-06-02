import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const task = await prisma.weeklyTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const client = createAnthropicClient()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [
      {
        name: 'break_into_steps',
        description: 'Break a task into concrete micro-steps, each 10-20 minutes long.',
        input_schema: {
          type: 'object' as const,
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Short, concrete action step' },
                  estimatedMinutes: { type: 'number', description: 'Time estimate in minutes (10-20)' },
                },
                required: ['title', 'estimatedMinutes'],
              },
              minItems: 3,
              maxItems: 5,
              description: '3-5 concrete steps to complete the task',
            },
          },
          required: ['steps'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'break_into_steps' },
    messages: [
      {
        role: 'user',
        content: `Break this task into 3-5 concrete micro-steps, each 10-20 minutes long. Task: "${task.title}"${task.effort ? `. Effort level: ${task.effort}/3` : ''}. Return actionable, specific steps.`,
      },
    ],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No tool response' }, { status: 500 })
  }

  const input = toolUse.input as { steps: { title: string; estimatedMinutes: number }[] }
  return NextResponse.json({ steps: input.steps })
}
