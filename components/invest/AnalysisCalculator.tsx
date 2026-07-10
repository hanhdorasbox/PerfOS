'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, RotateCcw } from 'lucide-react'
import { FIELD_DEFS, effectiveValue, type FieldDef } from '@/lib/invest/valuation/fields'
import { computeValuation } from '@/lib/invest/valuation/compute'
import { formatMoney, formatNumber, formatPercent, formatPercentSigned } from '@/lib/invest/format'

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

const STATUS_LABELS = { draft: 'rozpracovaná', active: 'aktivní', archived: 'archiv' } as const

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
      setError(data?.error ?? `Uložení pole selhalo (${res.status})`)
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
      setError(data?.error ?? `Uložení selhalo (${res.status})`)
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
      setError(data?.error ?? `Refetch selhal (${res.status})`)
      return
    }
    setRefetchDiffs(data.diffs ?? [])
    // pull fresh fetched values into local state
    for (const diff of data.diffs ?? []) {
      setLocal(diff.field, { fetchedValue: diff.current })
    }
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
          {isFetched && <Database size={11} aria-label="hodnota z API" className="fin-subtle" />}
          {isOverridden && <span className="fin-badge fin-badge-gold" style={{ fontSize: 9, padding: '0 6px' }}>override</span>}
          {diff && diff.changePct !== null && (
            <span className="fin-badge fin-badge-warn" style={{ fontSize: 9, padding: '0 6px' }}>
              fetched se změnilo o {formatPercentSigned(diff.changePct)}
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
              title="Reset na fetched hodnotu"
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
            placeholder="Poznámka — odkud číslo mám"
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
          aria-label="Název analýzy"
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
          aria-label="Status analýzy"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {fundamentalsFetchedAt && (
            <span className="fin-subtle" style={{ fontSize: 11 }}>
              fundamenty: {new Date(fundamentalsFetchedAt).toLocaleDateString('cs-CZ')}
            </span>
          )}
          <button type="button" className="fin-btn" onClick={() => void refetch()} disabled={refetching}>
            {refetching ? 'Stahuji…' : 'Aktualizovat fetched hodnoty'}
          </button>
        </span>
      </div>

      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}

      {/* ── Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Fair value (DCF)</div>
          <div className="fin-value-lg fin-gold" style={{ fontSize: 28 }}>
            {computed.fairValue ? formatMoney(computed.fairValue, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Implied (P/E)</div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromPe ? formatMoney(computed.impliedFromPe, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Implied (EV/EBITDA)</div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromEvEbitda ? formatMoney(computed.impliedFromEvEbitda, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Aktuální cena</div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {price !== null ? formatMoney(price, asset.currency) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>
            Margin of safety{target !== null && <> · cíl {formatPercent(target)}</>}
          </div>
          <div className={`fin-value-lg ${mosClass}`} style={{ fontSize: 28 }}>
            {mos !== null ? formatPercentSigned(mos) : '—'}
          </div>
        </div>
      </div>

      {computed.problems.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8 }}>K dopočtu fair value chybí</div>
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

      {/* ── DCF inputs ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16 }}>DCF — vstupy (FCFF, 5 let + terminal)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('dcf').map(fieldRow)}
        </div>
      </div>

      {/* ── WACC helper ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16 }}>Pomocník diskontní sazby (CAPM)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('wacc').map(fieldRow)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
            <div className="fin-subtle" style={{ fontSize: 12 }}>
              rf + beta × ERP ={' '}
              <span className="fin-mono fin-gold">
                {computed.capmRate ? formatPercent(computed.capmRate) : '—'}
              </span>
            </div>
            <button
              type="button"
              className="fin-btn"
              disabled={computed.capmRate === null}
              onClick={() => {
                if (computed.capmRate === null) return
                const value = Number(computed.capmRate)
                setLocal('discountRate', { manualValue: String(value) })
                void persistField('discountRate', value)
              }}
            >
              Použít jako diskontní sazbu
            </button>
          </div>
        </div>
      </div>

      {/* ── Relative valuation ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16 }}>Relativní valuace</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('relative').map(fieldRow)}
        </div>
      </div>

      {/* ── Sensitivity ── */}
      <div className="fin-card" style={{ overflowX: 'auto' }}>
        <div className="fin-label" style={{ marginBottom: 12 }}>
          Sensitivity — fair value | řádky: diskontní sazba · sloupce: terminal growth
        </div>
        {computed.sensitivity ? (
          <table className="fin-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th />
                {computed.sensitivity[0].map((cell) => (
                  <th key={cell.terminalGrowth} className="fin-num">
                    {formatPercent(cell.terminalGrowth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.sensitivity.map((row) => (
                <tr key={row[0].discountRate}>
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
          <div className="fin-empty">Tabulka se zobrazí, až bude DCF kompletní.</div>
        )}
      </div>

      {/* ── Qualitative notes ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 12 }}>
          Kvalitativní poznámky (moat, management, rizika — markdown)
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
