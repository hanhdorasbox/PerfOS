'use client'
import { useState, useEffect } from 'react'


const CLOCK_H = 186
const BIO_START = 7
const BIO_END = 22
const BIO_TOTAL = BIO_END - BIO_START

function toPct(h: number, m = 0) {
  return Math.min(1, Math.max(0, (h + m / 60 - BIO_START) / BIO_TOTAL))
}

const BIO_ZONES = [
  { start: 7,  end: 9,  accent: '#C8A06A', label: 'Ramp Up',    bestFor: 'Light tasks, admin, morning routine' },
  { start: 9,  end: 12, accent: '#5EAA88', label: 'Peak Focus', bestFor: 'Deep work, complex decisions, writing' },
  { start: 12, end: 14, accent: '#6E6E76', label: 'Low Tide',   bestFor: 'Lunch, light reading, short breaks' },
  { start: 14, end: 17, accent: '#5E94BB', label: '2nd Wind',   bestFor: 'Collaboration, calls, creative work' },
  { start: 17, end: 20, accent: '#C8906A', label: 'Wind Down',  bestFor: 'Review, planning, low-intensity work' },
  { start: 20, end: 22, accent: '#8E80C4', label: 'Recovery',   bestFor: 'Rest, reading, reflection' },
]

export default function BioClock() {
  const [now, setNow] = useState(() => new Date())
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    // Trigger the arc draw-in on mount
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => { clearInterval(id); cancelAnimationFrame(raf) }
  }, [])

  const h = now.getHours()
  const m = now.getMinutes()
  const nowPct = toPct(h, m)
  const isActive = h >= BIO_START && h < BIO_END
  const currentZone = BIO_ZONES.find(z => h >= z.start && h < z.end)
  const nextZone = BIO_ZONES.find(z => z.start > h) ?? null
  const minsToNext = nextZone ? (nextZone.start * 60) - (h * 60 + m) : null
  const accent = currentZone?.accent ?? '#6E6E76'
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  // Circular gauge constants
  const SZ = 160, CX = 80, CY = 92, R = 56, SW = 8
  const ARC_START = 225  // degrees from top, clockwise
  const ARC_SWEEP = 270  // total sweep

  function gaugeXY(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180
    return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) }
  }

  function gaugePath(fromDeg: number, toDeg: number, r: number): string {
    const sweep = ((toDeg - fromDeg) % 360 + 360) % 360
    if (sweep < 0.5) return ''
    const s = gaugeXY(fromDeg, r)
    const e = gaugeXY(toDeg, r)
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }

  const bgPath = gaugePath(ARC_START, ARC_START + ARC_SWEEP, R)
  const progressEndDeg = ARC_START + nowPct * ARC_SWEEP
  const progressPath = isActive && nowPct > 0.01
    ? gaugePath(ARC_START, progressEndDeg, R)
    : ''
  const dotPos = isActive ? gaugeXY(progressEndDeg, R) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Arc + time */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: SZ, height: SZ, marginTop: 8 }}>
          <svg width={SZ} height={SZ} style={{ display: 'block', overflow: 'visible' }}>
            {/* Background arc */}
            <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} strokeLinecap="round" />
            {/* Zone-tinted arc segments */}
            {BIO_ZONES.map(z => {
              const zFrom = ARC_START + toPct(z.start) * ARC_SWEEP
              const zTo = ARC_START + toPct(z.end) * ARC_SWEEP
              return (
                <path key={z.label} d={gaugePath(zFrom, zTo, R)} fill="none"
                  stroke={z.accent + '28'} strokeWidth={SW} />
              )
            })}
            {/* Progress arc — draws in on mount via pathLength normalization */}
            {progressPath && (
              <path d={progressPath} fill="none" stroke={accent} strokeWidth={SW} strokeLinecap="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1}
                style={{
                  filter: `drop-shadow(0 0 5px ${accent}70)`,
                  transition: 'stroke 1s ease, stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.2s',
                }} />
            )}
            {/* Zone separator ticks */}
            {BIO_ZONES.slice(1).map(z => {
              const tickDeg = ARC_START + toPct(z.start) * ARC_SWEEP
              const inner = gaugeXY(tickDeg, R - SW / 2 - 1)
              const outer = gaugeXY(tickDeg, R + SW / 2 + 1)
              return (
                <line key={z.label} x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
                  x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
                  stroke="rgba(10,10,12,0.9)" strokeWidth={1.5} />
              )
            })}
            {/* Current position dot — fades in after the arc finishes drawing */}
            {dotPos && (
              <circle cx={dotPos.x.toFixed(2)} cy={dotPos.y.toFixed(2)} r={5} fill={accent}
                style={{
                  filter: `drop-shadow(0 0 7px ${accent})`,
                  opacity: drawn ? 1 : 0,
                  transition: 'opacity 0.5s ease 1.3s',
                }} />
            )}
          </svg>
          {/* Center text */}
          <div style={{
            position: 'absolute', top: '57%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#EEEEF2', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 5 }}>
              {currentZone?.label ?? (h < BIO_START ? 'Before day' : 'After day')}
            </div>
          </div>
        </div>
      </div>

      {/* Best for */}
      {currentZone && (
        <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3E3E44', marginBottom: 4 }}>
            Best for
          </div>
          <div style={{ fontSize: 11, color: '#8E8E93', lineHeight: 1.5 }}>{currentZone.bestFor}</div>
        </div>
      )}

      {/* Next state */}
      {nextZone && minsToNext != null && minsToNext > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <span style={{ fontSize: 9, color: '#3E3E44', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: nextZone.accent }}>{nextZone.label}</span>
            <span style={{ fontSize: 10, color: '#52525A', marginLeft: 6 }}>
              in {minsToNext >= 60 ? `${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m` : `${minsToNext}m`}
            </span>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
        {BIO_ZONES.map(z => {
          const isCurrent = z === currentZone
          return (
            <div key={z.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: isCurrent ? 1 : 0.3 }}>
              <div style={{ width: isCurrent ? 18 : 12, height: 2.5, borderRadius: 2, background: isCurrent ? z.accent : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
              <span style={{ fontSize: 5.5, color: isCurrent ? z.accent : '#52525A', letterSpacing: '0.04em', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                {z.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
