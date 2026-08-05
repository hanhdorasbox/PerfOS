'use client'
// Synchronised guitar neck. Shows the notes sounding at the current playhead,
// coloured by musical voice, with fret + finger labels.

import type { Arrangement, TabNote, Voice } from '@/lib/guitar/types'
import { noteName } from '@/lib/guitar/theory'

export const VOICE_COLORS: Record<Voice, { text: string; bg: string; border: string; glow: string }> = {
  melody: { text: '#64f0aa', bg: 'rgba(100,240,170,0.14)', border: 'rgba(100,240,170,0.5)', glow: 'rgba(100,240,170,0.5)' },
  bass: { text: '#ffc648', bg: 'rgba(255,198,72,0.14)', border: 'rgba(255,198,72,0.5)', glow: 'rgba(255,198,72,0.45)' },
  harmony: { text: '#61adff', bg: 'rgba(97,173,255,0.14)', border: 'rgba(97,173,255,0.5)', glow: 'rgba(97,173,255,0.45)' },
  percussion: { text: '#ff567b', bg: 'rgba(255,86,123,0.14)', border: 'rgba(255,86,123,0.5)', glow: 'rgba(255,86,123,0.4)' },
}

const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']

export default function Fretboard({
  arrangement,
  currentBeat,
}: {
  arrangement: Arrangement
  currentBeat: number
}) {
  const numStrings = arrangement.tuning.strings.length
  const FRETS = 12
  const W = 720
  const H = 200
  const padL = 34
  const padR = 16
  const padT = 22
  const padB = 18
  const fretW = (W - padL - padR) / FRETS
  const strGap = (H - padT - padB) / (numStrings - 1)

  const active: TabNote[] = arrangement.notes.filter(
    (n) => currentBeat >= n.start - 1e-6 && currentBeat < n.start + n.duration - 1e-6 && n.voice !== 'percussion',
  )

  const yFor = (s: number) => padT + s * strGap
  const xForFret = (f: number) => (f === 0 ? padL - 12 : padL + (f - 0.5) * fretW)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} role="img" aria-label="Fretboard">
        {/* fretboard wood */}
        <rect x={padL} y={padT - 8} width={W - padL - padR} height={H - padT - padB + 16} rx={6}
          fill="rgba(120,80,45,0.10)" stroke="rgba(255,255,255,0.06)" />
        {/* nut */}
        <rect x={padL - 3} y={padT - 8} width={4} height={H - padT - padB + 16} fill="rgba(255,255,255,0.55)" rx={2} />
        {/* frets */}
        {Array.from({ length: FRETS }, (_, i) => i + 1).map((f) => (
          <line key={f} x1={padL + f * fretW} y1={padT - 8} x2={padL + f * fretW} y2={H - padB + 8}
            stroke="rgba(255,255,255,0.13)" strokeWidth={1} />
        ))}
        {/* inlay dots */}
        {[3, 5, 7, 9].map((f) => (
          <circle key={f} cx={padL + (f - 0.5) * fretW} cy={H / 2} r={3.5} fill="rgba(255,255,255,0.16)" />
        ))}
        <circle cx={padL + (12 - 0.5) * fretW} cy={H / 2 - strGap} r={3.5} fill="rgba(255,255,255,0.16)" />
        <circle cx={padL + (12 - 0.5) * fretW} cy={H / 2 + strGap} r={3.5} fill="rgba(255,255,255,0.16)" />
        {/* strings + labels */}
        {Array.from({ length: numStrings }, (_, s) => (
          <g key={s}>
            <text x={12} y={yFor(s) + 4} fontSize={12} fill="#6E6E76" fontFamily="monospace">{STRING_NAMES[s] ?? '?'}</text>
            <line x1={padL} y1={yFor(s)} x2={W - padR} y2={yFor(s)}
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.6 + s * 0.35} />
          </g>
        ))}
        {/* fret numbers */}
        {[3, 5, 7, 9, 12].map((f) => (
          <text key={f} x={padL + (f - 0.5) * fretW} y={H - 4} fontSize={9} fill="#52525A" textAnchor="middle">{f}</text>
        ))}
        {/* active notes */}
        {active.map((n, i) => {
          const c = VOICE_COLORS[n.voice]
          const cx = xForFret(n.fret)
          const cy = yFor(Math.min(numStrings - 1, n.string))
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={12} fill={c.bg} stroke={c.border} strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }} />
              <text x={cx} y={cy + 3.5} fontSize={10} fontWeight={700} fill={c.text} textAnchor="middle">
                {n.finger ?? (n.fret === 0 ? '○' : n.fret)}
              </text>
              <text x={cx} y={cy - 15} fontSize={8.5} fill={c.text} textAnchor="middle" opacity={0.85}>
                {noteName(n.pitch).replace(/[0-9-]/g, '')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
