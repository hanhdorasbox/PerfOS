/**
 * Parse bank statement PDFs by sending them to Claude for structured extraction.
 * Handles Czech bank PDF formats (ČSOB, KB, Fio, Moneta, Raiffeisen, etc.)
 */

import { createAnthropicClient } from './anthropic'
import type { ParsedTransaction } from './statementParser'

export async function parsePDFStatement(fileBuffer: ArrayBuffer): Promise<ParsedTransaction[]> {
  const base64 = Buffer.from(fileBuffer).toString('base64')

  const response = await createAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `This is a Czech bank statement PDF. Extract ALL transactions from it.

Return ONLY valid JSON — no markdown, no explanation:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "merchant or transaction description",
      "amount": -1234.56,
      "account": "account number or name if shown"
    }
  ]
}

Rules:
- "date" must be ISO format YYYY-MM-DD
- "amount" must be a number: negative for expenses/debits, positive for income/credits
- "description" should be the most useful identifying text (merchant name, transfer note, etc.)
- "account" is optional — include only if the statement shows multiple accounts or an account field per row
- Include ALL transactions, including fees, interest, standing orders
- Skip header rows, totals, opening/closing balances — only include individual transactions
- If amounts use Czech format (e.g. "1 234,56 Kč"), convert to plain number (-1234.56)
- Do NOT skip any transactions, even small ones

Respond ONLY with JSON.`,
          },
        ],
      },
    ],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown code fences
  const text = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Claude did not return JSON from PDF. Response preview: ${rawText.slice(0, 200)}`)

  let parsed: { transactions: Array<{ date: string; description: string; amount: number; account?: string }> }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    // Fallback: try to find and parse just the transactions array
    const arrMatch = rawText.match(/"transactions"\s*:\s*(\[[\s\S]*?\])/)
    if (arrMatch) {
      try {
        const transactions = JSON.parse(arrMatch[1])
        if (Array.isArray(transactions)) {
          return transactions
            .filter((t: { date?: unknown; amount?: unknown }) => t.date && typeof t.amount === 'number')
            .map((t: { date: string; description?: string; amount: number; account?: string }) => ({
              date: t.date,
              description: (t.description || '').trim(),
              amount: t.amount,
              account: t.account?.trim() || undefined,
            }))
        }
      } catch { /* fall through to error */ }
    }
    throw new Error(`JSON parse failed from PDF extraction: ${String(e)}. Preview: ${jsonMatch[0].slice(0, 200)}`)
  }

  if (!Array.isArray(parsed.transactions)) throw new Error('No transactions array in PDF extraction result')

  return parsed.transactions
    .filter(t => t.date && typeof t.amount === 'number')
    .map(t => ({
      date: t.date,
      description: (t.description || '').trim(),
      amount: t.amount,
      account: t.account?.trim() || undefined,
    }))
}
