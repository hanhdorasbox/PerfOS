// App-wide passcode lock — stateless signed token in an httpOnly cookie.
// Runtime-agnostic (Web Crypto), so it works in both the edge `proxy` and
// Node route handlers. No DB, no server-side session store.

export const LOCK_COOKIE = 'ph_lock'
// Idle timeout: the token is valid for this long and re-issued (slid) on
// activity, so an hour with no requests locks the app.
export const LOCK_TTL_MS = 60 * 60 * 1000

function getSecret(): string | null {
  return process.env.APP_SESSION_SECRET ?? process.env.CRON_SECRET ?? null
}

/**
 * The lock is only active when a PIN and a signing secret are both present.
 * Missing either → fail-open (app stays unlocked) so a misconfiguration can
 * never lock the owner out with no way back in.
 */
export function isLockConfigured(): boolean {
  return Boolean(process.env.APP_PIN?.trim() && getSecret())
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig)
}

/** Length-safe constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Token format: `<issuedAtMs>.<hmac(issuedAtMs)>`. */
export async function createToken(now: number = Date.now()): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('Lock secret is not configured')
  const iat = String(now)
  return `${iat}.${await hmac(iat, secret)}`
}

/** Valid = signature matches AND the token is younger than LOCK_TTL_MS. */
export async function verifyToken(
  token: string | undefined | null,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false
  const secret = getSecret()
  if (!secret) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const iatStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const iat = Number(iatStr)
  if (!Number.isFinite(iat)) return false
  if (now - iat > LOCK_TTL_MS || iat > now + 60_000) return false
  const expected = await hmac(iatStr, secret)
  return timingSafeEqual(sig, expected)
}

/** Checks a submitted PIN against APP_PIN in constant time.
 * Both sides are trimmed so a stray space/newline in the APP_PIN env var
 * (a common paste artifact in dashboards) can't lock the owner out. */
export function verifyPin(pin: string): boolean {
  const expected = process.env.APP_PIN?.trim()
  if (!expected) return false
  return timingSafeEqual(pin.trim(), expected)
}
