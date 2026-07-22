'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RefreshResult {
  ok: boolean
  updated: number
  skipped: number
  recomputed: number
  failed: Array<{ ticker: string; error: string }>
}

// Bulk-refreshes current prices for every watchlisted / active-analysis asset,
// then re-renders the page so MoS and fair-value columns reflect the new quotes.
export default function RefreshPricesButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function refresh() {
    setBusy(true)
    setStatus(null)
    setIsError(false)
    try {
      const res = await fetch('/api/invest/prices/refresh', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as RefreshResult | null
      if (!res.ok || !data?.ok) {
        setIsError(true)
        setStatus(data ? JSON.stringify(data) : `Error (${res.status})`)
        return
      }
      const parts = [`${data.updated} updated`]
      if (data.skipped > 0) parts.push(`${data.skipped} manual`)
      if (data.failed.length > 0) parts.push(`${data.failed.length} failed`)
      setIsError(data.failed.length > 0)
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
          style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {status}
        </span>
      )}
      <button type="button" className="fin-btn" onClick={() => void refresh()} disabled={busy}>
        {busy ? 'Refreshing…' : 'Refresh prices'}
      </button>
    </div>
  )
}
