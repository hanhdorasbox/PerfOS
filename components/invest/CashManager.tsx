'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime, formatMoney } from '@/lib/invest/format'

export interface CashRow {
  id: string
  currency: string
  amount: string
  source: 'manual' | 't212'
  updatedAt: string
}

export default function CashManager({ initialCash }: { initialCash: CashRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ currency: 'CZK', amount: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/invest/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Error (${res.status})`)
      return
    }
    setForm((f) => ({ ...f, amount: '' }))
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {initialCash.length > 0 && (
        <table className="fin-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Currency</th>
              <th className="fin-num">Amount</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {initialCash.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className={row.source === 't212' ? 'fin-badge fin-badge-gold' : 'fin-badge'}>
                    {row.source === "t212" ? "Trading212" : "manual reserve"}
                  </span>
                </td>
                <td className="fin-mono">{row.currency}</td>
                <td className="fin-num">{formatMoney(row.amount, row.currency)}</td>
                <td className="fin-subtle">{formatDateTime(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="fin-field-label" htmlFor="cash-currency">Currency</label>
          <select
            id="cash-currency"
            className="fin-select"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option value="CZK">CZK</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label className="fin-field-label" htmlFor="cash-amount">Manual reserve (money set aside)</label>
          <input
            id="cash-amount"
            type="number"
            step="any"
            min="0"
            className="fin-input fin-mono"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            required
          />
        </div>
        <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save reserve"}
        </button>
      </form>
      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
      <p className="fin-subtle" style={{ margin: 0, fontSize: 12 }}>
        Trading212 rows are managed by the sync and overwritten on each run; your manual reserve stays yours.
      </p>
    </div>
  )
}
