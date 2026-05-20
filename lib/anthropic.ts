/**
 * Shared Anthropic client factory.
 *
 * Problem: Claude Code (the IDE) sets ANTHROPIC_API_KEY="" in its process
 * environment. When `next dev` is launched from within Claude Code, the child
 * process inherits that empty string. Standard dotenv never overrides existing
 * env vars, so .env.local's real key is never used.
 *
 * Fix: when process.env.ANTHROPIC_API_KEY is empty, read the key directly from
 * the .env files, bypassing the parent-process override.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

let cachedKey: string | null = null

export function getAnthropicApiKey(): string {
  if (cachedKey) return cachedKey

  // Try process.env first (works when server is started outside Claude Code)
  const envVal = process.env.ANTHROPIC_API_KEY?.replace(/^["']|["']$/g, '').trim()
  if (envVal) {
    cachedKey = envVal
    return cachedKey
  }

  // Fallback: read directly from .env files so we bypass the parent override
  for (const envFile of ['.env.local', '.env']) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), envFile), 'utf8')
      const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
      if (match) {
        const val = match[1].replace(/^["']|["']$/g, '').trim()
        if (val) {
          cachedKey = val
          return cachedKey
        }
      }
    } catch {
      // File doesn't exist or isn't readable — try the next one
    }
  }

  throw new Error(
    'ANTHROPIC_API_KEY is not configured. Add it to .env.local:\n  ANTHROPIC_API_KEY=sk-ant-api03-...'
  )
}

export function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() })
}
