'use client'
import { useState, useEffect } from 'react'

export interface RingSpec {
  pct: number    // 0–100
  color: string  // hex
}

// Apple-watch style concentric rings with staggered draw-in on mount.
export default function ActivityRings({
  rings,
  size = 150,
  stroke = 11,
  gap = 4,
  children,
}: {
  rings: RingSpec[]        // outer → inner
  size?: number
  stroke?: number
  gap?: number
  children?: React.ReactNode
}) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const c = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        {rings.map((ring, i) => {
          const r = c - stroke / 2 - i * (stroke + gap)
          if (r <= 0) return null
          const circ = 2 * Math.PI * r
          const pct = Math.min(100, Math.max(0, ring.pct))
          const offset = circ * (1 - pct / 100)
          return (
            <g key={i}>
              {/* Dimmed track in the same hue */}
              <circle cx={c} cy={c} r={r} fill="none" stroke={ring.color + '22'} strokeWidth={stroke} />
              <circle
                cx={c} cy={c} r={r} fill="none"
                stroke={ring.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={drawn ? offset : circ}
                style={{ transition: `stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.16}s` }}
              />
            </g>
          )
        })}
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          pointerEvents: 'none',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
