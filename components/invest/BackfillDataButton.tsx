'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Backfills company data (sector, country, logo) for tracked stocks whose
// snapshot predates that capture. Progressive: if a batch remains, it says so.
export default function BackfillDataButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function run() {
    setBusy(true)
    setStatus(null)
    setIsError(false)
    try {
      const res = await fetch('/api/invest/fundamentals/refresh', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as
        | { refreshed?: number; remaining?: number; failed?: string[] }
        | null
      if (!res.ok || !data) {
        setIsError(true)
        setStatus(`Error (${res.status})`)
        return
      }
      const parts = [`${data.refreshed ?? 0} updated`]
      if (data.remaining) parts.push(`${data.remaining} left — click again`)
      if (data.failed && data.failed.length > 0) parts.push(`${data.failed.length} failed`)
      setIsError((data.failed?.length ?? 0) > 0)
      setStatus(parts.join(' · '))
      router.refresh()
    } catch (e) {
      setIsError(true)
      setStatus(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {status && (
        <span
          className={isError ? 'fin-warn' : 'fin-subtle'}
          style={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {status}
        </span>
      )}
      <button type="button" className="fin-btn" onClick={() => void run()} disabled={busy}>
        {busy ? 'Fetching…' : 'Fetch sectors & logos'}
      </button>
    </div>
  )
}
