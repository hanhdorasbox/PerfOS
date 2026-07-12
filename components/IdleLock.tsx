'use client'

import { useEffect } from 'react'

const IDLE_MS = 60 * 60 * 1000 // lock after 1h of no interaction
const STORAGE_KEY = 'ph_last_activity'

/**
 * Client-side idle guard. The server cookie is the source of truth, but this
 * also locks a tab/PWA that's been left open but untouched for an hour — and
 * re-checks on focus/visibility in case background timers were throttled.
 */
export default function IdleLock({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return

    const mark = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
    }

    let locking = false
    const lockNow = async () => {
      if (locking) return
      locking = true
      try {
        await fetch('/api/lock', { method: 'POST' })
      } catch {
        /* ignore */
      }
      const next = window.location.pathname + window.location.search
      window.location.replace(`/lock?next=${encodeURIComponent(next)}`)
    }

    const check = () => {
      let last = 0
      try {
        last = Number(localStorage.getItem(STORAGE_KEY)) || 0
      } catch {
        /* ignore */
      }
      if (last && Date.now() - last > IDLE_MS) void lockNow()
    }

    const onActivity = () => mark()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    mark()
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(check, 30_000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [enabled])

  return null
}
