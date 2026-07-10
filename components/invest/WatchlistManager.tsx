'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPercent, formatPercentSigned } from '@/lib/invest/format'
import type { AssetOption } from './TransactionForm'

export interface WatchlistRow {
  id: string
  assetId: string
  ticker: string
  name: string
  targetMos: string
  note: string | null
  /** MoS of the asset's active analysis, null when none */
  currentMos: string | null
}

export default function WatchlistManager({
  items,
  assets,
}: {
  items: WatchlistRow[]
  assets: AssetOption[]
}) {
  const router = useRouter()
  const available = assets.filter((a) => !items.some((i) => i.assetId === a.id))
  const [form, setForm] = useState({ assetId: available[0]?.id ?? '', targetMos: '25', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/invest/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: form.assetId,
        targetMos: Number(form.targetMos.replace(',', '.')) / 100,
        note: form.note || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Chyba (${res.status})`)
      return
    }
    setForm((f) => ({ ...f, note: '' }))
    router.refresh()
  }

  async function updateTarget(item: WatchlistRow, raw: string) {
    const pct = Number(raw.replace(',', '.'))
    if (!Number.isFinite(pct)) return
    await fetch('/api/invest/watchlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, targetMos: pct / 100 }),
    })
    router.refresh()
  }

  async function remove(item: WatchlistRow) {
    if (!window.confirm(`Odebrat ${item.ticker} z watchlistu?`)) return
    await fetch(`/api/invest/watchlist?id=${item.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.length > 0 && (
        <table className="fin-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="fin-num">Target MoS</th>
              <th className="fin-num">Aktuální MoS</th>
              <th className="fin-num">Vzdálenost k cíli</th>
              <th>Poznámka</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const target = Number(item.targetMos)
              const current = item.currentMos !== null ? Number(item.currentMos) : null
              const distance = current !== null ? current - target : null
              return (
                <tr key={item.id}>
                  <td>
                    <span className="fin-mono" style={{ fontWeight: 600 }}>{item.ticker}</span>
                    <div className="fin-subtle" style={{ fontSize: 11 }}>{item.name}</div>
                  </td>
                  <td className="fin-num">
                    <input
                      className="fin-input fin-mono"
                      style={{ width: 72, textAlign: 'right', padding: '4px 8px' }}
                      defaultValue={String(Math.round(target * 1000) / 10)}
                      onBlur={(e) => void updateTarget(item, e.target.value)}
                      aria-label={`Target MoS pro ${item.ticker} v procentech`}
                    />{' '}
                    <span className="fin-subtle">%</span>
                  </td>
                  <td className={`fin-num ${current === null ? 'fin-muted' : current >= target ? 'fin-gain' : 'fin-muted'}`}>
                    {current !== null ? formatPercentSigned(current) : '—'}
                  </td>
                  <td className={`fin-num ${distance === null ? 'fin-muted' : distance >= 0 ? 'fin-gain' : 'fin-warn'}`}>
                    {distance !== null ? formatPercentSigned(distance) : '—'}
                  </td>
                  <td className="fin-subtle" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.note ?? ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="fin-btn fin-btn-danger"
                      style={{ padding: '3px 9px', fontSize: 12 }}
                      onClick={() => void remove(item)}
                    >
                      Odebrat
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {items.length === 0 && (
        <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
          Watchlist je prázdný. Target MoS ({formatPercent(0.25)} = kupní práh) nastavíš u každého assetu.
        </p>
      )}

      {available.length > 0 && (
        <form onSubmit={add} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="fin-field-label" htmlFor="wl-asset">Asset</label>
            <select
              id="wl-asset"
              className="fin-select fin-mono"
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              required
            >
              {available.map((a) => (
                <option key={a.id} value={a.id}>{a.ticker}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="fin-field-label" htmlFor="wl-target">Target MoS (%)</label>
            <input
              id="wl-target"
              className="fin-input fin-mono"
              style={{ width: 100 }}
              value={form.targetMos}
              onChange={(e) => setForm({ ...form, targetMos: e.target.value })}
              required
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="fin-field-label" htmlFor="wl-note">Poznámka</label>
            <input
              id="wl-note"
              className="fin-input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
            {saving ? 'Přidávám…' : 'Na watchlist'}
          </button>
        </form>
      )}
      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
    </div>
  )
}
