'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatPercentSigned } from '@/lib/invest/format'
import TargetMosCells from '@/components/invest/TargetMosCells'

export interface AnalysisRow {
  id: string
  assetId: string
  ticker: string
  name: string
  logo: string | null
  /** Blended fair value, already formatted in the display currency (or null) */
  blendedDisplay: string | null
  /** Blended margin of safety as a fraction */
  mos: number | null
  targetPct: number | null
  watchId: string | null
  updated: string
  sector: string
  continent: string
}

function AssetGlyph({ ticker, logo }: { ticker: string; logo: string | null }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={22} height={22} style={{ borderRadius: 5, objectFit: 'contain', background: '#fff', flexShrink: 0 }} />
  }
  const initials = ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  return (
    <span aria-hidden style={{ width: 22, height: 22, borderRadius: 5, background: '#2a2a31', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#c9c9d0', flexShrink: 0 }}>
      {initials}
    </span>
  )
}

function ChipRow({
  label,
  options,
  active,
  onPick,
}: {
  label: string
  options: string[]
  active: string | null
  onPick: (value: string | null) => void
}) {
  if (options.length < 2) return null
  const chip = (value: string | null, text: string) => {
    const on = active === value
    return (
      <button
        key={text}
        type="button"
        onClick={() => onPick(value)}
        className="fin-badge"
        style={{
          cursor: 'pointer',
          border: '1px solid var(--fin-border-strong, rgba(255,255,255,0.10))',
          ...(on ? { background: 'var(--fin-gold-bg, rgba(212,175,55,0.16))', color: 'var(--fin-gold)', borderColor: 'var(--fin-gold-border)' } : {}),
        }}
      >
        {text}
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="fin-subtle" style={{ fontSize: 11, minWidth: 52 }}>{label}</span>
      {chip(null, 'All')}
      {options.map((o) => chip(o, o))}
    </div>
  )
}

export default function AnalysesTable({ rows }: { rows: AnalysisRow[] }) {
  const [sector, setSector] = useState<string | null>(null)
  const [continent, setContinent] = useState<string | null>(null)

  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector))].sort(), [rows])
  const continents = useMemo(() => [...new Set(rows.map((r) => r.continent))].sort(), [rows])

  const filtered = rows.filter(
    (r) => (sector === null || r.sector === sector) && (continent === null || r.continent === continent),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(sectors.length > 1 || continents.length > 1) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ChipRow label="Sector" options={sectors} active={sector} onPick={setSector} />
          <ChipRow label="Region" options={continents} active={continent} onPick={setContinent} />
        </div>
      )}

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="fin-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th className="fin-num">Blended value</th>
              <th className="fin-num">MoS</th>
              <th className="fin-num">Target</th>
              <th className="fin-num">Distance</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/invest/analysis/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <AssetGlyph ticker={r.ticker} logo={r.logo} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="fin-mono" style={{ color: 'var(--fin-text)', fontWeight: 700 }}>{r.ticker}</span>
                      <span className="fin-subtle"> — {r.name}</span>
                    </span>
                  </Link>
                </td>
                <td className="fin-num fin-gold">{r.blendedDisplay ?? '—'}</td>
                <td className={`fin-num ${r.mos === null ? 'fin-muted' : r.mos > 0 ? 'fin-gain' : 'fin-loss'}`}>
                  {r.mos !== null ? formatPercentSigned(r.mos) : '—'}
                </td>
                <TargetMosCells assetId={r.assetId} watchId={r.watchId} initialTargetPct={r.targetPct} currentMos={r.mos} />
                <td className="fin-subtle">{r.updated}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="fin-empty">No stocks match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
