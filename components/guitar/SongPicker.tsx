'use client'
// Pick a song by name from the built-in library (traditional / public-domain
// melodies). Typing filters the list; choosing one loads its melody + tempo.

import { useMemo, useState } from 'react'
import { findSongs, songToMelody, melodyToTab, TUNINGS } from '@/lib/guitar'
import type { Song } from '@/lib/guitar/songs'
import type { TuningName } from '@/lib/guitar/types'

export default function SongPicker({
  tuning,
  capo,
  onPick,
}: {
  tuning: TuningName
  capo: number
  onPick: (info: { tab: string; tempo: number; beatsPerMeasure: number; title: string }) => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => findSongs(query), [query])

  function choose(song: Song) {
    const melody = songToMelody(song)
    const tab = melodyToTab(melody, TUNINGS[tuning], capo)
    onPick({ tab, tempo: song.tempo, beatsPerMeasure: song.beatsPerMeasure, title: song.title })
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a song name — e.g. “twinkle”, “jingle”, “amazing”…"
        style={{
          width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 9,
          background: 'var(--bg-inset, rgba(255,255,255,0.03))', color: '#EEEEF2',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
        {results.map((s) => (
          <button key={s.id} onClick={() => choose(s)} style={{
            textAlign: 'left', padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
            border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#EEEEF2' }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#6E6E76', marginTop: 2 }}>
              {s.subtitle ? s.subtitle + ' · ' : ''}{s.tempo} BPM
            </div>
          </button>
        ))}
        {results.length === 0 && (
          <p style={{ fontSize: 12.5, color: '#9E9EA6' }}>
            No match. The library holds traditional / public-domain tunes only —
            copyrighted pop songs can’t be pulled by name.
          </p>
        )}
      </div>
      <p style={{ fontSize: 11.5, marginTop: 10, color: '#6E6E76' }}>
        Pick a song → its melody loads into the tab and the tempo is set. Then hit Generate.
      </p>
    </div>
  )
}
