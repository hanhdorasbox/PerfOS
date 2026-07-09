'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface AssetOption {
  id: string
  ticker: string
  currency: string
}

const emptyForm = {
  assetId: '',
  type: 'buy',
  quantity: '',
  price: '',
  amount: '',
  executedAt: new Date().toISOString().slice(0, 10),
  note: '',
}

export default function TransactionForm({ assets }: { assets: AssetOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm, assetId: assets[0]?.id ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = assets.find((a) => a.id === form.assetId)
  const isDividend = form.type === 'dividend'

  function update(patch: Partial<typeof form>) {
    const next = { ...form, ...patch }
    // Convenience: amount defaults to quantity × price while both are set
    if ((patch.quantity !== undefined || patch.price !== undefined) && !isDividend) {
      const q = Number(next.quantity)
      const p = Number(next.price)
      if (q > 0 && p > 0) next.amount = String(Math.round(q * p * 10000) / 10000)
    }
    setForm(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/invest/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: form.assetId,
        type: form.type,
        quantity: form.quantity || undefined,
        price: form.price || undefined,
        amount: form.amount,
        executedAt: form.executedAt,
        note: form.note || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Chyba (${res.status})`)
      return
    }
    setForm({ ...emptyForm, assetId: form.assetId })
    setOpen(false)
    router.refresh()
  }

  if (assets.length === 0) return null

  if (!open) {
    return (
      <button type="button" className="fin-btn" onClick={() => setOpen(true)}>
        + Ruční transakce
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="fin-card" style={{ padding: 20 }}>
      <div className="fin-label" style={{ marginBottom: 14 }}>
        Ruční transakce (fallback mimo Trading212)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <div>
          <label className="fin-field-label" htmlFor="tx-asset">Asset</label>
          <select
            id="tx-asset"
            className="fin-select fin-mono"
            value={form.assetId}
            onChange={(e) => update({ assetId: e.target.value })}
            required
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.ticker}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="fin-field-label" htmlFor="tx-type">Typ</label>
          <select
            id="tx-type"
            className="fin-select"
            value={form.type}
            onChange={(e) => update({ type: e.target.value })}
          >
            <option value="buy">Nákup</option>
            <option value="sell">Prodej</option>
            <option value="dividend">Dividenda</option>
          </select>
        </div>
        {!isDividend && (
          <>
            <div>
              <label className="fin-field-label" htmlFor="tx-quantity">Kusy</label>
              <input
                id="tx-quantity"
                type="number"
                step="any"
                min="0"
                className="fin-input fin-mono"
                value={form.quantity}
                onChange={(e) => update({ quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="tx-price">
                Cena/ks ({selected?.currency ?? ''})
              </label>
              <input
                id="tx-price"
                type="number"
                step="any"
                min="0"
                className="fin-input fin-mono"
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
              />
            </div>
          </>
        )}
        <div>
          <label className="fin-field-label" htmlFor="tx-amount">
            Celkem ({selected?.currency ?? ''})
          </label>
          <input
            id="tx-amount"
            type="number"
            step="any"
            min="0"
            className="fin-input fin-mono"
            value={form.amount}
            onChange={(e) => update({ amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="fin-field-label" htmlFor="tx-date">Datum</label>
          <input
            id="tx-date"
            type="date"
            className="fin-input fin-mono"
            value={form.executedAt}
            onChange={(e) => update({ executedAt: e.target.value })}
            required
          />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="fin-field-label" htmlFor="tx-note">Poznámka</label>
        <input
          id="tx-note"
          className="fin-input"
          value={form.note}
          onChange={(e) => update({ note: e.target.value })}
        />
      </div>
      {error && <p className="fin-loss" style={{ margin: '12px 0 0', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
          {saving ? 'Ukládám…' : 'Uložit transakci'}
        </button>
        <button type="button" className="fin-btn" onClick={() => setOpen(false)}>Zrušit</button>
      </div>
    </form>
  )
}
