'use client'
// Interactive six-string TAB. Renders the arrangement on a 16th-note grid,
// highlights the sounding notes / current measure during playback, lets you click
// to seek, and click a note to select it for editing.

import { useMemo, useRef, useEffect } from 'react'
import type { Arrangement, TabNote } from '@/lib/guitar/types'
import { VOICE_COLORS } from './Fretboard'

const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']
const SUBDIV = 4

export default function TabView({
  arrangement,
  currentBeat,
  isPlaying,
  onSeek,
  selected,
  onSelect,
}: {
  arrangement: Arrangement
  currentBeat: number
  isPlaying: boolean
  onSeek: (beat: number) => void
  selected: TabNote | null
  onSelect: (n: TabNote | null) => void
}) {
  const bpm = arrangement.beatsPerMeasure
  const numStrings = arrangement.tuning.strings.length
  const cellsPer = bpm * SUBDIV
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeMeasureRef = useRef<HTMLDivElement>(null)

  const measures = arrangement.measures

  // Precompute, per measure, a grid[string][cell] -> note (onset only).
  const grids = useMemo(() => {
    return measures.map((m) => {
      const grid: (TabNote | null)[][] = Array.from({ length: numStrings }, () =>
        new Array(cellsPer).fill(null),
      )
      const rel = m.notes.map((n) => ({ n, cell: Math.round((n.start - m.index * bpm) * SUBDIV) }))
      // melody first so it wins a shared cell
      rel.sort((a, b) => voiceRank(a.n) - voiceRank(b.n))
      for (const { n, cell } of rel) {
        if (n.voice === 'percussion') continue
        if (cell < 0 || cell >= cellsPer) continue
        const s = Math.min(numStrings - 1, Math.max(0, n.string))
        if (!grid[s][cell]) grid[s][cell] = n
      }
      return grid
    })
  }, [measures, numStrings, cellsPer, bpm])

  const activeMeasure = Math.floor(currentBeat / bpm)

  // Auto-scroll the active measure into view during playback.
  useEffect(() => {
    if (isPlaying && activeMeasureRef.current) {
      activeMeasureRef.current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  }, [activeMeasure, isPlaying])

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {measures.map((m, mi) => {
        const isActiveM = mi === activeMeasure
        const playCell = isActiveM ? Math.floor((currentBeat - mi * bpm) * SUBDIV) : -1
        return (
          <div
            key={mi}
            ref={isActiveM ? activeMeasureRef : undefined}
            style={{
              border: `1px solid ${isActiveM ? 'rgba(100,240,170,0.35)' : 'var(--border, rgba(255,255,255,0.07))'}`,
              borderRadius: 10,
              padding: '8px 8px 6px',
              background: isActiveM ? 'rgba(100,240,170,0.04)' : 'rgba(255,255,255,0.015)',
              transition: 'border-color .2s, background .2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <span style={{ fontSize: 10, color: '#52525A' }}>{mi + 1}</span>
              {m.chord && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a085ff' }}>{m.chord.symbol}</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateRows: `repeat(${numStrings}, 18px)`, rowGap: 0 }}>
              {Array.from({ length: numStrings }, (_, s) => (
                <div
                  key={s}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `14px repeat(${cellsPer}, 17px)`,
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#44444A' }}>{STRING_NAMES[s] ?? '?'}</span>
                  {Array.from({ length: cellsPer }, (_, c) => {
                    const note = grids[mi][s][c]
                    const beat = mi * bpm + c / SUBDIV
                    const isBeatStart = c % SUBDIV === 0
                    const isPlayhead = c === playCell
                    if (!note) {
                      return (
                        <span
                          key={c}
                          onClick={() => onSeek(beat)}
                          style={{
                            textAlign: 'center',
                            color: isBeatStart ? '#3a3a42' : '#2c2c33',
                            fontSize: 12,
                            cursor: 'pointer',
                            background: isPlayhead ? 'rgba(100,240,170,0.10)' : 'transparent',
                            height: 18,
                            lineHeight: '18px',
                          }}
                        >
                          {isBeatStart ? '+' : '-'}
                        </span>
                      )
                    }
                    const col = VOICE_COLORS[note.voice]
                    const isActive = currentBeat >= note.start - 1e-6 && currentBeat < note.start + note.duration - 1e-6
                    const isSel = selected === note
                    return (
                      <span
                        key={c}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(isSel ? null : note)
                        }}
                        title={`${note.voice} • fret ${note.fret}${note.finger ? ` • finger ${note.finger}` : ''}${note.technique ? ` • ${note.technique}` : ''}`}
                        style={{
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: col.text,
                          cursor: 'pointer',
                          borderRadius: 4,
                          height: 18,
                          lineHeight: '18px',
                          background: isActive ? col.bg : isSel ? 'rgba(255,255,255,0.06)' : 'transparent',
                          boxShadow: isActive ? `0 0 8px ${col.glow}` : isSel ? `inset 0 0 0 1px ${col.border}` : 'none',
                          outline: note.technique ? `1px dotted ${col.border}` : 'none',
                        }}
                      >
                        {note.fret}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function voiceRank(n: TabNote): number {
  return n.voice === 'melody' ? 0 : n.voice === 'harmony' ? 1 : n.voice === 'bass' ? 2 : 3
}
