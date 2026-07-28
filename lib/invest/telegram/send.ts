// Telegram Bot API sender. Mirrors the email/send.ts contract: no-ops (returns
// false) when unconfigured instead of throwing, so a missing bot token never
// turns a cron run red. Set up a bot via @BotFather, then configure:
//   TELEGRAM_BOT_TOKEN  — the token BotFather gives you
//   TELEGRAM_CHAT_ID    — your chat id (message the bot, then read it from
//                         https://api.telegram.org/bot<token>/getUpdates)

const API_BASE = 'https://api.telegram.org'

// Telegram hard-caps a single message at 4096 chars; stay comfortably under.
const MAX_MESSAGE_CHARS = 3900

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

async function sendOne(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
}

/**
 * Sends one HTML message (splitting into several if it exceeds Telegram's
 * length limit, breaking on blank lines so a block is never cut mid-way).
 * Returns false without throwing when Telegram isn't configured.
 */
export async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  for (const chunk of splitForTelegram(html)) {
    await sendOne(token, chatId, chunk)
  }
  return true
}

/** Splits on blank lines so no single message exceeds the Telegram cap. */
export function splitForTelegram(text: string, limit = MAX_MESSAGE_CHARS): string[] {
  if (text.length <= limit) return [text]
  const blocks = text.split('\n\n')
  const chunks: string[] = []
  let current = ''
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block
    if (candidate.length <= limit) {
      current = candidate
      continue
    }
    if (current) chunks.push(current)
    // A single block longer than the limit gets hard-sliced as a last resort.
    if (block.length <= limit) {
      current = block
    } else {
      for (let i = 0; i < block.length; i += limit) chunks.push(block.slice(i, i + limit))
      current = ''
    }
  }
  if (current) chunks.push(current)
  return chunks
}
