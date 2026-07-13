'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, RotateCcw } from 'lucide-react'
import { FIELD_DEFS, effectiveValue, type FieldDef } from '@/lib/invest/valuation/fields'
import { computeValuation } from '@/lib/invest/valuation/compute'
import { formatMoney, formatNumber, formatPercent, formatPercentSigned } from '@/lib/invest/format'
import InfoHint from '@/components/invest/InfoHint'

export interface CalcInput {
  field: string
  fetchedValue: string | null
  manualValue: string | null
  note: string | null
  source: string
  snapshotAt: string
}

export interface CalcAnalysis {
  id: string
  title: string
  status: 'draft' | 'active' | 'archived'
  qualitativeNotes: string
}

interface Props {
  analysis: CalcAnalysis
  asset: { ticker: string; name: string; currency: string }
  initialInputs: CalcInput[]
  currentPrice: string | null
  targetMos: string | null
  fundamentalsFetchedAt: string | null
}

type InputMap = Record<string, CalcInput>

const STATUS_LABELS = { draft: 'draft', active: 'active', archived: 'archived' } as const

function toMap(inputs: CalcInput[]): InputMap {
  return Object.fromEntries(inputs.map((i) => [i.field, i]))
}

/** Editor value: percents are edited as 2.5 (=0.025), others raw. */
function toEditor(def: FieldDef, value: string | null): string {
  if (value === null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return def.format === 'percent' ? String(Math.round(n * 1e6) / 1e4) : String(n)
}

function fromEditor(def: FieldDef, raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return def.format === 'percent' ? n / 100 : n
}

function formatByDef(def: FieldDef, value: string | null, currency: string): string {
  if (value === null) return '—'
  if (def.format === 'percent') return formatPercent(value)
  if (def.format === 'money') return formatMoney(value, currency, 2)
  return formatNumber(value, 2)
}

export default function AnalysisCalculator({
  analysis,
  asset,
  initialInputs,
  currentPrice,
  targetMos,
  fundamentalsFetchedAt,
}: Props) {
  const router = useRouter()
  const [inputs, setInputs] = useState<InputMap>(toMap(initialInputs))
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState(analysis.qualitativeNotes)
  const [status, setStatus] = useState(analysis.status)
  const [title, setTitle] = useState(analysis.title)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refetchDiffs, setRefetchDiffs] = useState<
    Array<{ field: string; changePct: number | null }>
  >([])
  const [refetching, setRefetching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fading, setFading] = useState(false)

  const computed = useMemo(
    () => computeValuation(Object.values(inputs), currentPrice),
    [inputs, currentPrice],
  )

  const problemFields = new Set(computed.problems.map((p) => p.field))

  async function persistField(field: string, manualValue: number | null, note?: string | null) {
    setSaving(field)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}/inputs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, manualValue, ...(note !== undefined ? { note } : {}) }),
    })
    setSaving(null)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Failed to save field (${res.status})`)
      return false
    }
    return true
  }

  function setLocal(field: string, patch: Partial<CalcInput>) {
    setInputs((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }))
  }

  async function commitDraft(def: FieldDef) {
    const raw = drafts[def.key]
    if (raw === undefined) return
    const current = inputs[def.key]
    const parsed = fromEditor(def, raw)

    // For fetched fields an empty input means "reset to fetched"
    const manualValue =
      parsed === null ? null : parsed
    const prevManual = current?.manualValue ?? null
    const nextManual = manualValue === null ? null : String(manualValue)
    setDrafts((d) => {
      const next = { ...d }
      delete next[def.key]
      return next
    })
    if (nextManual === prevManual) return

    setLocal(def.key, { manualValue: nextManual })
    const ok = await persistField(def.key, manualValue)
    if (!ok) setLocal(def.key, { manualValue: prevManual })
  }

  async function resetField(def: FieldDef) {
    const prev = inputs[def.key]?.manualValue ?? null
    setLocal(def.key, { manualValue: null })
    const ok = await persistField(def.key, null)
    if (!ok) setLocal(def.key, { manualValue: prev })
  }

  async function saveNote(def: FieldDef, note: string) {
    const current = inputs[def.key]
    const manual = current?.manualValue !== null ? Number(current?.manualValue) : null
    setLocal(def.key, { note: note || null })
    await persistField(def.key, manual, note || null)
  }

  async function patchAnalysis(patch: Record<string, unknown>) {
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Save failed (${res.status})`)
      return
    }
    router.refresh()
  }

  async function refetch() {
    setRefetching(true)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}/refetch`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    setRefetching(false)
    if (!res.ok) {
      setError(data?.error ?? `Refetch failed (${res.status})`)
      return
    }
    setRefetchDiffs(data.diffs ?? [])
    // pull fresh fetched values into local state
    for (const diff of data.diffs ?? []) {
      setLocal(diff.field, { fetchedValue: diff.current })
    }
    if (data.priceError) {
      setError(`Fundamentals updated, but the current price couldn't be fetched: ${data.priceError}`)
    }
    // Pull the freshly stored price snapshot into the page so Current Price
    // and Margin of Safety update without a manual reload.
    router.refresh()
  }

  // Linear growth fade: year 1 = current Y1 growth, year 5 = terminal growth,
  // years 2–4 evenly interpolated. Persists all five as overrides.
  async function applyFade() {
    const startRaw = effectiveValue(inputs['fcfGrowthY1'] ?? { fetchedValue: null, manualValue: null })
    const endRaw = effectiveValue(inputs['terminalGrowth'] ?? { fetchedValue: null, manualValue: null })
    const start = startRaw !== null ? Number(startRaw) : NaN
    const end = endRaw !== null ? Number(endRaw) : NaN
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('Set Year-1 growth and Terminal growth first — fade fills years 2–5 between them.')
      return
    }
    setFading(true)
    setError(null)
    const step = (end - start) / 4
    for (let y = 1; y <= 5; y++) {
      const value = start + step * (y - 1)
      const field = `fcfGrowthY${y}`
      setLocal(field, { manualValue: String(value) })
      const ok = await persistField(field, value)
      if (!ok) break
    }
    setFading(false)
  }

  async function deleteAnalysis() {
    if (!confirm(`Delete analysis "${title}" for ${asset.ticker}? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Delete failed (${res.status})`)
      setDeleting(false)
      return
    }
    router.push('/invest/analysis')
    router.refresh()
  }

  function fieldRow(def: FieldDef) {
    const input = inputs[def.key]
    if (!input) return null
    const isOverridden = input.manualValue !== null && input.fetchedValue !== null
    const isFetched = input.manualValue === null && input.fetchedValue !== null
    const diff = refetchDiffs.find((d) => d.field === def.key)
    const hasProblem = problemFields.has(def.key)
    const draft = drafts[def.key]

    const fetchedDelta =
      isOverridden && Number(input.fetchedValue) !== 0
        ? (Number(input.manualValue) - Number(input.fetchedValue)) /
          Math.abs(Number(input.fetchedValue))
        : null

    return (
      <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="fin-field-label" htmlFor={`field-${def.key}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
          {def.label}
          {def.hint && <InfoHint text={def.hint} />}
          {isFetched && <Database size={11} aria-label="value from API" className="fin-subtle" />}
          {isOverridden && <span className="fin-badge fin-badge-gold" style={{ fontSize: 9, padding: '0 6px' }}>override</span>}
          {diff && diff.changePct !== null && (
            <span className="fin-badge fin-badge-warn" style={{ fontSize: 9, padding: '0 6px' }}>
              fetched changed by {formatPercentSigned(diff.changePct)}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id={`field-${def.key}`}
            type="text"
            inputMode="decimal"
            className="fin-input fin-mono"
            style={{
              ...(isOverridden
                ? { borderColor: 'var(--fin-gold-border)', fontWeight: 700 }
                : {}),
              ...(isFetched ? { color: 'var(--fin-text-2)' } : {}),
              ...(hasProblem ? { borderColor: 'var(--fin-loss-border)' } : {}),
            }}
            value={draft !== undefined ? draft : toEditor(def, effectiveValue(input))}
            placeholder={def.format === 'percent' ? '% p.a.' : '—'}
            onChange={(e) => setDrafts((d) => ({ ...d, [def.key]: e.target.value }))}
            onBlur={() => void commitDraft(def)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={saving === def.key}
          />
          {def.format === 'percent' && <span className="fin-subtle" style={{ fontSize: 12 }}>%</span>}
          {isOverridden && (
            <button
              type="button"
              className="fin-btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              title="Reset to fetched value"
              onClick={() => void resetField(def)}
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
        {isOverridden && (
          <div className="fin-subtle" style={{ fontSize: 11 }}>
            <s>{formatByDef(def, input.fetchedValue, asset.currency)}</s>
            {fetchedDelta !== null && (
              <span className="fin-gold"> {formatPercentSigned(fetchedDelta)} vs. fetched</span>
            )}
          </div>
        )}
        {def.help && !isOverridden && (
          <div className="fin-subtle" style={{ fontSize: 11 }}>{def.help}</div>
        )}
        {(def.key === 'peBenchmark' || def.key === 'evEbitdaBenchmark') && (
          <input
            type="text"
            className="fin-input"
            style={{ fontSize: 12 }}
            placeholder="Note — where the number comes from"
            defaultValue={input.note ?? ''}
            onBlur={(e) => void saveNote(def, e.target.value.trim())}
          />
        )}
      </div>
    )
  }

  const price = currentPrice !== null ? Number(currentPrice) : null
  const target = targetMos !== null ? Number(targetMos) : null
  const mos = computed.marginOfSafety !== null ? Number(computed.marginOfSafety) : null

  const mosClass =
    mos === null
      ? 'fin-muted'
      : target !== null && mos >= target
        ? 'fin-gain'
        : mos > 0
          ? 'fin-warn'
          : 'fin-loss'

  const group = (name: FieldDef['group']) => FIELD_DEFS.filter((d) => d.group === name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div className="fin-card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="fin-input"
          style={{ maxWidth: 340, fontWeight: 600 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== analysis.title && void patchAnalysis({ title })}
          aria-label="Analysis name"
        />
        <select
          className="fin-select"
          style={{ width: 'auto' }}
          value={status}
          onChange={(e) => {
            const next = e.target.value as typeof status
            setStatus(next)
            void patchAnalysis({ status: next })
          }}
          aria-label="Analysis status"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {fundamentalsFetchedAt && (
            <span className="fin-subtle" style={{ fontSize: 11 }}>
              fundamentals: {new Date(fundamentalsFetchedAt).toLocaleDateString('en-US')}
            </span>
          )}
          <button type="button" className="fin-btn" onClick={() => void refetch()} disabled={refetching}>
            {refetching ? 'Fetching…' : 'Refresh data & price'}
          </button>
          <button
            type="button"
            className="fin-btn"
            style={{ borderColor: 'var(--fin-loss-border)', color: 'var(--fin-loss)' }}
            onClick={() => void deleteAnalysis()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete analysis'}
          </button>
        </span>
      </div>

      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}

      {/* ── Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Fair value (DCF)
            <InfoHint text="What one share is worth per the discounted-cash-flow model: present value of 5 years of FCF plus terminal value, minus net debt, divided by shares. Your intrinsic-value estimate to compare against the market price." />
          </div>
          <div className="fin-value-lg fin-gold" style={{ fontSize: 28 }}>
            {computed.fairValue ? formatMoney(computed.fairValue, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Implied (P/E)
            <InfoHint text="A second, independent value estimate: sector P/E benchmark × EPS. If it disagrees a lot with the DCF, revisit your assumptions." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromPe ? formatMoney(computed.impliedFromPe, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Implied (EV/EBITDA)
            <InfoHint text="A third value estimate: (sector EV/EBITDA × EBITDA − net debt) ÷ shares. Cross-check the DCF and P/E — three methods agreeing is a stronger signal." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromEvEbitda ? formatMoney(computed.impliedFromEvEbitda, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Current price
            <InfoHint text="The latest market price from the daily price snapshot. Shows “—” until a price has been fetched (or set manually) for this asset." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {price !== null ? formatMoney(price, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Margin of safety{target !== null && <> · target {formatPercent(target)}</>}
            <InfoHint text="(Fair value − price) ÷ fair value. How far below intrinsic value the stock trades. Positive = trading below fair value (cushion); negative = above. The bigger the buffer, the more room for error in your assumptions." />
          </div>
          <div className={`fin-value-lg ${mosClass}`} style={{ fontSize: 28 }}>
            {mos !== null ? formatPercentSigned(mos) : '—'}
          </div>
        </div>
      </div>

      {computed.problems.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8 }}>Missing for fair value calculation</div>
          <ul className="fin-warn" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {computed.problems.map((p, i) => (
              <li key={i}>
                {p.field ? `${FIELD_DEFS.find((d) => d.key === p.field)?.label ?? p.field}: ` : ''}
                {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {computed.warnings.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Sanity check
            <InfoHint text="These don't block the calculation, but the numbers look inconsistent — most often FCF, net debt and total debt entered in different scales (absolute vs. millions). They must all be in the same units." />
          </div>
          <ul className="fin-warn" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {computed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── DCF inputs ── */}
      <div className="fin-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="fin-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            DCF — inputs (FCFF, 5 years + terminal)
            <InfoHint text="Projects free cash flow for 5 years, then a perpetual terminal value, discounts both to today at the discount rate (mid-year convention — cash arrives through the year, not on Dec 31), subtracts net debt, and divides by shares. Most of the value usually sits in the terminal value — so the discount rate and terminal growth matter most." />
          </div>
          <button
            type="button"
            className="fin-btn"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => void applyFade()}
            disabled={fading}
          >
            {fading ? 'Fading…' : 'Fade to terminal'}
            <InfoHint text="Fills years 1–5 by linearly stepping from your Year-1 growth down to the terminal growth. More realistic than holding one high growth rate flat for 5 years. You can still fine-tune any single year afterwards." />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('dcf').map(fieldRow)}
        </div>
      </div>

      {/* ── WACC helper ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          Discount-rate helper (WACC)
          <InfoHint text="Builds the discount rate for the DCF. Cost of equity = risk-free + beta × equity risk premium (CAPM). WACC then blends that with the after-tax cost of debt, weighted by market cap vs. total debt. For an FCFF model, WACC is the correct rate — use it, not the cost of equity alone." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('wacc').map(fieldRow)}
        </div>
        {/* Result + action in their own footer row, right-aligned */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 20,
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid var(--fin-border-strong, rgba(255,255,255,0.08))',
            flexWrap: 'wrap',
          }}
        >
          <span className="fin-subtle" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            Cost of equity
            <InfoHint text="rf + beta × ERP. The return equity investors require. It’s the equity leg of the WACC — with no debt, WACC equals this." />
            ={' '}
            <span className="fin-mono">
              {computed.capmRate ? formatPercent(computed.capmRate) : '—'}
            </span>
          </span>
          <span className="fin-subtle" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            WACC
            <InfoHint text="E/V × cost of equity + D/V × cost of debt × (1 − tax). Needs cost of debt, tax rate, total debt, shares and the current price. Falls back to cost of equity if those aren’t all set." />
            ={' '}
            <span className="fin-mono fin-gold">
              {computed.wacc ? formatPercent(computed.wacc) : '—'}
            </span>
          </span>
          <button
            type="button"
            className="fin-btn"
            disabled={computed.wacc === null && computed.capmRate === null}
            onClick={() => {
              const source = computed.wacc ?? computed.capmRate
              if (source === null) return
              const value = Number(source)
              setLocal('discountRate', { manualValue: String(value) })
              void persistField('discountRate', value)
            }}
          >
            {computed.wacc ? 'Use WACC as discount rate' : 'Use cost of equity as discount rate'}
          </button>
        </div>
      </div>

      {/* ── Relative valuation ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16 }}>Relative valuation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('relative').map(fieldRow)}
        </div>
      </div>

      {/* ── Sensitivity ── */}
      <div className="fin-card" style={{ overflowX: 'auto' }}>
        <div className="fin-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          Sensitivity — fair value per share
          <InfoHint text="Fair value at nearby discount rates and terminal growth rates. The gold-outlined cell is your base case. Green = meets your target margin of safety at the current price; red = fair value below the current price. Shows how fragile the result is to the two assumptions that matter most." />
        </div>
        {computed.sensitivity ? (
          <table className="fin-table" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th
                  colSpan={computed.sensitivity[0].length}
                  style={{
                    textAlign: 'center',
                    color: 'var(--fin-gold)',
                    fontWeight: 600,
                    fontSize: 11,
                    letterSpacing: 0.3,
                    paddingBottom: 2,
                    border: 'none',
                  }}
                >
                  Terminal growth →
                </th>
              </tr>
              <tr>
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                {computed.sensitivity[0].map((cell) => (
                  <th key={cell.terminalGrowth} className="fin-num">
                    {formatPercent(cell.terminalGrowth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.sensitivity.map((row, rowIndex) => (
                <tr key={row[0].discountRate}>
                  {rowIndex === 0 && (
                    <th
                      rowSpan={computed.sensitivity!.length}
                      style={{
                        writingMode: 'vertical-rl',
                        textAlign: 'center',
                        color: 'var(--fin-gold)',
                        fontWeight: 600,
                        fontSize: 11,
                        letterSpacing: 0.3,
                        whiteSpace: 'nowrap',
                        padding: '0 4px',
                        border: 'none',
                        background: 'transparent',
                      }}
                    >
                      Discount rate (WACC) ↓
                    </th>
                  )}
                  <td className="fin-num fin-muted">{formatPercent(row[0].discountRate)}</td>
                  {row.map((cell) => {
                    const fv = cell.fairValue !== null ? Number(cell.fairValue) : null
                    const cellMos = fv !== null && price !== null && fv > 0 ? (fv - price) / fv : null
                    const background =
                      fv === null
                        ? undefined
                        : target !== null && cellMos !== null && cellMos >= target
                          ? 'var(--fin-gain-bg)'
                          : price !== null && fv < price
                            ? 'var(--fin-loss-bg)'
                            : undefined
                    return (
                      <td
                        key={cell.terminalGrowth}
                        className="fin-num"
                        style={{
                          background,
                          ...(cell.isBase
                            ? {
                                outline: '1px solid var(--fin-gold)',
                                outlineOffset: -1,
                                color: 'var(--fin-gold)',
                                fontWeight: 700,
                              }
                            : {}),
                        }}
                      >
                        {fv !== null ? formatNumber(fv, 1) : '×'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="fin-empty">The table appears once the DCF is complete.</div>
        )}
      </div>

      {/* ── Qualitative notes ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 12 }}>
          Qualitative notes (moat, management, risks — markdown)
        </div>
        <textarea
          className="fin-input"
          style={{ minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== analysis.qualitativeNotes && void patchAnalysis({ qualitativeNotes: notes })}
        />
      </div>
    </div>
  )
}
