'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetOption } from './TransactionForm'

export interface AlertRuleRow {
  id: string
  name: string
  type: string
  params: Record<string, unknown>
  isActive: boolean
  cooldownHours: number
}

const TYPE_LABELS: Record<string, string> = {
  price_vs_fair_value: 'Price vs. fair value / MoS target',
  position_weight: 'Position weight above threshold',
  drawdown_from_peak: 'Drawdown from peak',
  pe_percentile: 'P/E above own-history percentile',
  cash_below: 'Cash reserve below threshold',
  analysis_stale: 'Active analysis is stale',
}

function describeParams(rule: AlertRuleRow, assets: AssetOption[]): string {
  const p = rule.params
  const asset = assets.find((a) => a.id === p.assetId)?.ticker
  const pct = (v: unknown) => `${Math.round(Number(v) * 1000) / 10}%`
  switch (rule.type) {
    case 'price_vs_fair_value':
      return `threshold ${pct(p.thresholdPct ?? 0.1)}${asset ? ` · ${asset} only` : ' · all active analyses'}`
    case 'position_weight':
      return `weight > ${pct(p.thresholdPct)}${asset ? ` · ${asset} only` : ''}`
    case 'drawdown_from_peak':
      return `drawdown ≥ ${pct(p.thresholdPct)} over ${p.periodDays ?? 180} days${asset ? ` · ${asset} only` : ' · whole portfolio'}`
    case 'pe_percentile':
      return `${asset ?? '?'} · above ${Math.round(Number(p.percentile ?? 0.9) * 100)}th percentile`
    case 'cash_below':
      return `cash < ${Number(p.thresholdCzk).toLocaleString('en-US')} CZK`
    case 'analysis_stale':
      return `older than ${p.months ?? 6} months`
    default:
      return ''
  }
}

const emptyForm = {
  name: '',
  type: 'price_vs_fair_value',
  thresholdPct: '10',
  periodDays: '180',
  percentile: '90',
  thresholdCzk: '',
  months: '6',
  assetId: '',
  cooldownHours: '72',
}

export default function AlertRulesManager({
  rules,
  assets,
}: {
  rules: AlertRuleRow[]
  assets: AssetOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildParams(): Record<string, unknown> {
    const pct = Number(form.thresholdPct.replace(',', '.')) / 100
    switch (form.type) {
      case 'price_vs_fair_value':
        return { thresholdPct: pct, ...(form.assetId ? { assetId: form.assetId } : {}) }
      case 'position_weight':
        return { thresholdPct: pct, ...(form.assetId ? { assetId: form.assetId } : {}) }
      case 'drawdown_from_peak':
        return {
          thresholdPct: pct,
          periodDays: Number(form.periodDays),
          ...(form.assetId ? { assetId: form.assetId } : {}),
        }
      case 'pe_percentile':
        return { assetId: form.assetId, percentile: Number(form.percentile.replace(',', '.')) / 100 }
      case 'cash_below':
        return { thresholdCzk: Number(form.thresholdCzk.replace(/\s/g, '').replace(',', '.')) }
      case 'analysis_stale':
        return { months: Number(form.months) }
      default:
        return {}
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/invest/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        params: buildParams(),
        cooldownHours: Number(form.cooldownHours),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Error (${res.status})`)
      return
    }
    setForm(emptyForm)
    setOpen(false)
    router.refresh()
  }

  async function toggle(rule: AlertRuleRow) {
    await fetch('/api/invest/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    })
    router.refresh()
  }

  async function remove(rule: AlertRuleRow) {
    if (!window.confirm(`Delete rule “${rule.name}” including its history?`)) return
    await fetch(`/api/invest/alerts?id=${rule.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const needsAsset = form.type === 'pe_percentile'
  const optionalAsset = ['price_vs_fair_value', 'position_weight', 'drawdown_from_peak'].includes(form.type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="fin-label">Rules ({rules.length})</span>
        <button type="button" className="fin-btn fin-btn-primary" onClick={() => setOpen(!open)}>
          + New rule
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="fin-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label className="fin-field-label" htmlFor="ar-name">Name *</label>
              <input
                id="ar-name"
                className="fin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. AAPL near target"
                required
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="ar-type">Type</label>
              <select
                id="ar-type"
                className="fin-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fin-field-label" htmlFor="ar-cooldown">Cooldown (hours)</label>
              <input
                id="ar-cooldown"
                type="number"
                min="1"
                className="fin-input fin-mono"
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: e.target.value })}
              />
            </div>

            {(form.type === 'price_vs_fair_value' || form.type === 'position_weight' || form.type === 'drawdown_from_peak') && (
              <div>
                <label className="fin-field-label" htmlFor="ar-threshold">Threshold (%)</label>
                <input
                  id="ar-threshold"
                  className="fin-input fin-mono"
                  value={form.thresholdPct}
                  onChange={(e) => setForm({ ...form, thresholdPct: e.target.value })}
                  required
                />
              </div>
            )}
            {form.type === 'drawdown_from_peak' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-period">Period (days)</label>
                <input
                  id="ar-period"
                  type="number"
                  min="7"
                  className="fin-input fin-mono"
                  value={form.periodDays}
                  onChange={(e) => setForm({ ...form, periodDays: e.target.value })}
                />
              </div>
            )}
            {form.type === 'pe_percentile' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-percentile">Percentile (%)</label>
                <input
                  id="ar-percentile"
                  className="fin-input fin-mono"
                  value={form.percentile}
                  onChange={(e) => setForm({ ...form, percentile: e.target.value })}
                />
              </div>
            )}
            {form.type === 'cash_below' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-cash">Threshold (CZK)</label>
                <input
                  id="ar-cash"
                  className="fin-input fin-mono"
                  value={form.thresholdCzk}
                  onChange={(e) => setForm({ ...form, thresholdCzk: e.target.value })}
                  required
                />
              </div>
            )}
            {form.type === 'analysis_stale' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-months">Age (months)</label>
                <input
                  id="ar-months"
                  type="number"
                  min="1"
                  className="fin-input fin-mono"
                  value={form.months}
                  onChange={(e) => setForm({ ...form, months: e.target.value })}
                />
              </div>
            )}
            {(needsAsset || optionalAsset) && (
              <div>
                <label className="fin-field-label" htmlFor="ar-asset">
                  Asset{optionalAsset ? ' (optional — otherwise all)' : ' *'}
                </label>
                <select
                  id="ar-asset"
                  className="fin-select fin-mono"
                  value={form.assetId}
                  onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                  required={needsAsset}
                >
                  <option value="">— all —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.ticker}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create rule"}
            </button>
            <button type="button" className="fin-btn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="fin-empty">No rules. Alerts are evaluated every evening as part of the daily cron.</div>
      ) : (
        <table className="fin-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Condition</th>
              <th className="fin-num">Cooldown</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} style={{ opacity: rule.isActive ? 1 : 0.5 }}>
                <td>
                  <span style={{ fontWeight: 600 }}>{rule.name}</span>
                  <div className="fin-subtle" style={{ fontSize: 11 }}>{TYPE_LABELS[rule.type] ?? rule.type}</div>
                </td>
                <td className="fin-muted" style={{ fontSize: 12 }}>{describeParams(rule, assets)}</td>
                <td className="fin-num">{rule.cooldownHours} h</td>
                <td>
                  <button
                    type="button"
                    className={rule.isActive ? 'fin-badge fin-badge-gain' : 'fin-badge'}
                    style={{ cursor: 'pointer', background: 'transparent' }}
                    onClick={() => void toggle(rule)}
                    title="Toggle active/disabled"
                  >
                    {rule.isActive ? "active" : "disabled"}
                  </button>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="fin-btn fin-btn-danger"
                    style={{ padding: '3px 9px', fontSize: 12 }}
                    onClick={() => void remove(rule)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
