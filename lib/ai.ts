import { createAnthropicClient } from './anthropic'

const client = createAnthropicClient()

export async function generateQuarterlyPlan(goals: string[], context: string): Promise<any> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: `You are a strategic performance advisor. Convert user goal descriptions into structured quarterly plans.
Return ONLY valid JSON. No markdown, no explanation.
Schema: {
  "goals": [{
    "title": string,
    "category": string,
    "trackingType": "QUANTITATIVE"|"BINARY"|"MILESTONE"|"CADENCE",
    "startValue": number|null,
    "targetValue": number|null,
    "unit": string|null,
    "priorityWeight": number (1-3),
    "milestones": [{"title": string, "weight": number, "weekOffset": number}],
    "weeklyTargets": string[],
    "risks": string[],
    "measurement": string
  }]
}`,
    messages: [{
      role: 'user',
      content: `Goals to plan: ${goals.join(', ')}\nContext: ${context}\nCreate a practical quarterly execution plan.`
    }]
  })
  const text = (response.content[0] as any).text
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

export async function askAdvisor(question: string, dashboardData: any): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: `You are a strategic performance advisor — direct, analytical, no fluff. You have access to the user's performance dashboard data. Reference specific numbers, goals, and deadlines. Never give vague motivational advice. Be like a senior chief of staff reviewing a performance report.`,
    messages: [{
      role: 'user',
      content: `Dashboard data:\n${JSON.stringify(dashboardData, null, 2)}\n\nQuestion: ${question}`
    }]
  })
  return (response.content[0] as any).text
}
