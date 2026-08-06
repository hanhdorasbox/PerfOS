'use client'
// ─── AI Acoustic Guitar Arranger — main UI ────────────────────────────────────
//
// Ties the deterministic arrangement engine to an interactive editor, an acoustic
// Web-Audio player, a synced fretboard and MIDI/MusicXML export. Everything runs
// client-side so it works offline and needs no backend.

import { useEffect, useState } from 'react'
import {
  TUNINGS,
  parseTab,
  renderTab,
  generateArrangements,
  harmoniseSegment,
  makeChord,
  chooseBass,
  voiceChordUnder,
  suggestFinger,
  pitchAt,
  noteName,
  toMidi,
  toMusicXml,
  EXAMPLE_TAB,
  EXAMPLE_ODE,
} from '@/lib/guitar'
import type {
  Arrangement,
  ArrangeOptions,
  ArrangementStyle,
  MelodyStrictness,
  TabNote,
  TuningName,
  Voice,
} from '@/lib/guitar/types'
import { useGuitarPlayer } from './useGuitarPlayer'
import TabView from './TabView'
import Fretboard, { VOICE_COLORS } from './Fretboard'
import AudioImport from './AudioImport'
import YouTubeRef from './YouTubeRef'

const STYLES: { id: ArrangementStyle; label: string }[] = [
  { id: 'simple-fingerstyle', label: 'Simple Fingerstyle' },
  { id: 'chord-melody', label: 'Chord Melody' },
  { id: 'latin-acoustic', label: 'Latin Acoustic' },
  { id: 'travis', label: 'Travis Picking' },
  { id: 'soft-acoustic', label: 'Soft Acoustic' },
]

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25]
const VOICES: Voice[] = ['melody', 'bass', 'harmony', 'percussion']

export default function GuitarArranger() {
  const [tab, setTab] = useState(EXAMPLE_ODE)
  const [inputMode, setInputMode] = useState<'tab' | 'audio' | 'youtube'>('tab')
  const [baseBeats, setBaseBeats] = useState(0.5) // eighth notes
  const [opts, setOpts] = useState<ArrangeOptions>({
    style: 'simple-fingerstyle',
    difficulty: 2,
    tuning: 'standard',
    capo: 0,
    tempo: 96,
    beatsPerMeasure: 4,
    strictness: 'exact',
  })

  const [variants, setVariants] = useState<Arrangement[] | null>(null)
  const [keyName, setKeyName] = useState('')
  const [vi, setVi] = useState(1) // Balanced by default
  const [selected, setSelected] = useState<TabNote | null>(null)
  const [error, setError] = useState<string | null>(null)

  const arrangement = variants ? variants[vi] : null

  // Player + its options.
  const player = useGuitarPlayer(arrangement)
  const [speed, setSpeed] = useState(1)
  const [metronome, setMetronome] = useState(false)
  const [countIn, setCountIn] = useState(false)
  const [volume, setVolume] = useState(0.9)
  const [muted, setMuted] = useState<Voice[]>([])
  const [solo, setSolo] = useState<Voice | null>(null)
  const [loopOn, setLoopOn] = useState(false)
  const [loopStart, setLoopStart] = useState(1)
  const [loopEnd, setLoopEnd] = useState(2)

  const numMeasures = arrangement?.measures.length ?? 1

  useEffect(() => {
    player.setOptions({
      speed,
      metronome,
      countIn,
      masterVolume: volume,
      muted: new Set(muted),
      solo,
      loop: loopOn
        ? {
            start: (Math.max(1, loopStart) - 1) * (arrangement?.beatsPerMeasure ?? 4),
            end: Math.min(numMeasures, Math.max(loopStart, loopEnd)) * (arrangement?.beatsPerMeasure ?? 4),
          }
        : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, metronome, countIn, volume, muted, solo, loopOn, loopStart, loopEnd, arrangement])

  function generate(next: Partial<ArrangeOptions> = {}) {
    const merged = { ...opts, ...next }
    setOpts(merged)
    try {
      const melody = parseTab(tab, TUNINGS[merged.tuning], merged.capo, {
        baseBeats,
        beatsPerMeasure: merged.beatsPerMeasure,
      })
      if (melody.events.length === 0) {
        setError('No melody notes found. Paste a six-line TAB with fret numbers.')
        return
      }
      const { key, variants: vs } = generateArrangements(melody, merged)
      setVariants(vs)
      setKeyName(key.name)
      setSelected(null)
      setError(null)
    } catch (e) {
      setError('Could not parse that TAB. ' + (e instanceof Error ? e.message : ''))
    }
  }

  // ── Editing helpers (operate on the active variant, immutably) ───────────────

  function updateArrangement(mutator: (a: Arrangement) => Arrangement) {
    if (!variants) return
    const copy = variants.slice()
    copy[vi] = mutator(variants[vi])
    setVariants(copy)
  }

  function rebuildMeasures(a: Arrangement, notes: TabNote[]): Arrangement {
    const bpm = a.beatsPerMeasure
    const measures = a.measures.map((m) => ({
      ...m,
      notes: notes
        .filter((n) => Math.floor(n.start / bpm) === m.index)
        .sort((x, y) => x.start - y.start || y.string - x.string),
    }))
    return { ...a, notes: [...notes].sort((x, y) => x.start - y.start || y.string - x.string), measures }
  }

  function editNote(note: TabNote, patch: Partial<TabNote>) {
    updateArrangement((a) => {
      const notes = a.notes.map((n) => (n === note ? { ...n, ...patch } : n))
      const updated = notes.find((n, i) => a.notes[i] === note)
      if (updated) setSelected(updated)
      return rebuildMeasures(a, notes)
    })
  }

  function nudgeFret(note: TabNote, delta: number) {
    const fret = Math.max(0, Math.min(15, note.fret + delta))
    const pitch = pitchAt(arrangement!.tuning, arrangement!.capo, note.string, fret)
    editNote(note, { fret, pitch, technique: undefined })
  }

  function moveString(note: TabNote, delta: number) {
    const tuning = arrangement!.tuning
    const newString = note.string + delta
    if (newString < 0 || newString >= tuning.strings.length) return
    // Keep the same pitch: find the fret on the new string.
    const fret = note.pitch - (tuning.strings[newString] + arrangement!.capo)
    if (fret < 0 || fret > 15) return
    editNote(note, { string: newString, fret })
  }

  function deleteNote(note: TabNote) {
    updateArrangement((a) => rebuildMeasures(a, a.notes.filter((n) => n !== note)))
    setSelected(null)
  }

  function toggleLock(note: TabNote) {
    editNote(note, { locked: !note.locked })
  }

  // Cycle the chord of a measure through the ranked harmonisations and re-voice it.
  function cycleChord(measureIndex: number) {
    if (!arrangement) return
    updateArrangement((a) => {
      const bpm = a.beatsPerMeasure
      const m = a.measures[measureIndex]
      const melodyNotes = m.notes.filter((n) => n.voice === 'melody')
      const rel = melodyNotes.map((n) => ({ pitch: n.pitch, start: n.start - measureIndex * bpm, duration: n.duration }))
      const prevRoot = measureIndex > 0 ? a.measures[measureIndex - 1].chord?.root : undefined
      const choices = harmoniseSegment(rel, a.key, prevRoot)
      if (choices.length === 0) return a
      const curIdx = choices.findIndex((c) => c.symbol === m.chord?.symbol)
      const next = choices[(curIdx + 1) % choices.length]

      // Rebuild this measure's accompaniment under the (untouched) melody.
      const chordObj = makeChord(next.root, next.quality)
      const acc: TabNote[] = []
      const handFret = Math.round(melodyNotes.reduce((s, n) => s + n.fret, 0) / Math.max(1, melodyNotes.length))
      const bassBeats = bpm >= 4 ? [0, 2] : [0]
      for (const bb of bassBeats) {
        const pos = chooseBass(a.tuning, a.capo, next.root, { handFret: Math.max(handFret, 2) })
        if (pos) {
          acc.push({
            pitch: pitchAt(a.tuning, a.capo, pos.string, pos.fret),
            string: pos.string, fret: pos.fret,
            start: measureIndex * bpm + bb, duration: bpm >= 4 ? 2 : bpm,
            voice: 'bass', pima: 'p', velocity: 0.85,
          })
        }
      }
      for (const mn of melodyNotes) {
        if (mn.string > 2) continue
        const tones = voiceChordUnder(a.tuning, a.capo, chordObj, {
          melodyString: mn.string, handFret: mn.fret || handFret, maxTones: 2, lowestString: 4,
        })
        for (const t of tones) {
          acc.push({
            pitch: pitchAt(a.tuning, a.capo, t.string, t.fret),
            string: t.string, fret: t.fret, start: mn.start, duration: mn.duration,
            voice: 'harmony', velocity: 0.7,
          })
        }
      }
      // finger hints
      const groups = new Map<number, TabNote[]>()
      for (const n of [...melodyNotes, ...acc]) {
        if (n.fret === 0) continue
        const k = Math.round(n.start * 8)
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k)!.push(n)
      }
      for (const g of groups.values()) {
        const min = Math.min(...g.map((n) => n.fret))
        for (const n of g) n.finger = suggestFinger(n.fret, min)
      }

      const otherNotes = a.notes.filter((n) => Math.floor(n.start / bpm) !== measureIndex || n.voice === 'melody')
      const newNotes = [...otherNotes, ...acc]
      const rebuilt = rebuildMeasures(a, newNotes)
      rebuilt.measures[measureIndex] = { ...rebuilt.measures[measureIndex], chord: next }
      return rebuilt
    })
  }

  // ── Exports ──────────────────────────────────────────────────────────────────
  function download(name: string, data: BlobPart, type: string) {
    const blob = new Blob([data], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  function exportMidi() {
    if (arrangement) download(`arrangement-${arrangement.label}.mid`, toMidi(arrangement) as BlobPart, 'audio/midi')
  }
  function exportXml() {
    if (arrangement) download(`arrangement-${arrangement.label}.musicxml`, toMusicXml(arrangement), 'application/xml')
  }
  function copyTab() {
    if (arrangement) navigator.clipboard?.writeText(renderTab(arrangement.notes, arrangement.beatsPerMeasure))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1 — INPUT */}
      <Card>
        <SectionTitle n="1" title="Your melody" sub="Type a TAB, transcribe from audio, or pull up a YouTube reference. The engine keeps your melody and builds around it." />

        {/* Input mode */}
        <div style={{ display: 'flex', gap: 6, margin: '10px 0 14px', flexWrap: 'wrap' }}>
          {([['tab', '⌨ Type TAB'], ['audio', '🎙 From audio'], ['youtube', '▶ YouTube reference']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setInputMode(m)} style={miniBtn(inputMode === m)}>{label}</button>
          ))}
        </div>

        {inputMode === 'audio' && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: '1px solid var(--border, rgba(255,255,255,0.08))', background: 'rgba(255,255,255,0.015)' }}>
            <AudioImport
              tempo={opts.tempo}
              tuning={opts.tuning}
              capo={opts.capo}
              beatsPerMeasure={opts.beatsPerMeasure}
              onMelody={(t) => { setTab(t); setInputMode('tab') }}
            />
          </div>
        )}

        {inputMode === 'youtube' && (
          <div style={{ marginBottom: 14 }}>
            <YouTubeRef />
          </div>
        )}

        <textarea
          value={tab}
          onChange={(e) => setTab(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%', minHeight: 132, resize: 'vertical',
            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.5,
            background: 'var(--bg-inset, rgba(255,255,255,0.03))', color: '#EEEEF2',
            border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10, padding: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Chip onClick={() => setTab(EXAMPLE_ODE)}>Load “Ode to Joy”</Chip>
          <Chip onClick={() => setTab(EXAMPLE_TAB)}>Load example riff</Chip>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Label>Note spacing</Label>
            <Select value={String(baseBeats)} onChange={(v) => setBaseBeats(Number(v))}
              options={[['0.5', 'Eighth notes'], ['1', 'Quarter notes'], ['0.25', 'Sixteenths']]} />
          </span>
        </div>

        {/* Settings grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
          <Field label="Style">
            <Select value={opts.style} onChange={(v) => setOpts({ ...opts, style: v as ArrangementStyle })}
              options={STYLES.map((s) => [s.id, s.label] as [string, string])} />
          </Field>
          <Field label="Tuning">
            <Select value={opts.tuning} onChange={(v) => setOpts({ ...opts, tuning: v as TuningName })}
              options={Object.values(TUNINGS).map((t) => [t.name, t.label] as [string, string])} />
          </Field>
          <Field label={`Capo — ${opts.capo === 0 ? 'none' : 'fret ' + opts.capo}`}>
            <input type="range" min={0} max={12} value={opts.capo}
              onChange={(e) => setOpts({ ...opts, capo: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Difficulty — ${opts.difficulty}`}>
            <input type="range" min={1} max={5} value={opts.difficulty}
              onChange={(e) => setOpts({ ...opts, difficulty: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Tempo (BPM)">
            <input type="number" min={40} max={240} value={opts.tempo}
              onChange={(e) => setOpts({ ...opts, tempo: Number(e.target.value) })}
              style={inputStyle} />
          </Field>
          <Field label="Melody strictness">
            <Select value={opts.strictness} onChange={(v) => setOpts({ ...opts, strictness: v as MelodyStrictness })}
              options={[['exact', 'Exact'], ['flexible', 'Slightly flexible'], ['free', 'Freely arranged']]} />
          </Field>
        </div>

        <button onClick={() => generate()} style={primaryBtn}>🎸 Generate arrangement</button>
        {error && <p style={{ color: '#ff8263', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </Card>

      {arrangement && (
        <>
          {/* 2 — VERSIONS */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <SectionTitle n="2" title="Choose a version" inline />
              <span style={keyBadge}>Key: {keyName}</span>
              <span style={{ ...keyBadge, color: '#61adff', borderColor: 'rgba(97,173,255,0.3)' }}>
                {STYLES.find((s) => s.id === opts.style)?.label} · Lvl {opts.difficulty}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {variants!.map((v, i) => (
                <button key={v.label} onClick={() => { setVi(i); setSelected(null) }}
                  style={{
                    ...versionBtn,
                    borderColor: i === vi ? 'rgba(100,240,170,0.5)' : 'var(--border)',
                    background: i === vi ? 'rgba(100,240,170,0.08)' : 'rgba(255,255,255,0.02)',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: i === vi ? '#64f0aa' : '#EEEEF2' }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: '#9E9EA6', marginTop: 2 }}>{v.blurb}</div>
                </button>
              ))}
            </div>
            {/* Quick arrangement controls */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Chip onClick={() => generate({ difficulty: Math.max(1, opts.difficulty - 1) })}>Make it easier</Chip>
              <Chip onClick={() => generate({ difficulty: Math.min(5, opts.difficulty + 1) })}>Make it fuller</Chip>
              <Chip onClick={() => generate({ style: 'chord-melody' })}>Turn into chord melody</Chip>
              <Chip onClick={() => generate({ style: 'latin-acoustic' })}>Latin acoustic rhythm</Chip>
              <Chip onClick={() => generate({ style: 'soft-acoustic' })}>Make it softer</Chip>
              <Chip onClick={() => generate({ capo: 0, tuning: 'standard' })}>Reset tuning</Chip>
            </div>
          </Card>

          {/* PLAYER */}
          <Card>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => (player.isPlaying ? player.pause() : player.play())} style={transportBtn} aria-label="Play/Pause">
                {player.isPlaying ? '❚❚' : '▶'}
              </button>
              <button onClick={() => player.stop()} style={transportBtn} aria-label="Stop">■</button>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Label>Speed</Label>
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} style={miniBtn(speed === s)}>{s * 100 | 0}%</button>
                ))}
              </div>
              <Toggle on={metronome} onClick={() => setMetronome(!metronome)}>Metronome</Toggle>
              <Toggle on={countIn} onClick={() => setCountIn(!countIn)}>Count-in</Toggle>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Label>Vol</Label>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))} style={{ width: 80 }} />
              </span>
            </div>

            {/* progress / seek */}
            <input
              type="range" min={0} max={Math.max(0.01, player.totalBeats)} step={0.01} value={player.currentBeat}
              onChange={(e) => player.seek(Number(e.target.value))}
              style={{ width: '100%', marginTop: 12, accentColor: '#64f0aa' }}
            />

            {/* voices + loop */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Label>Voices</Label>
              {VOICES.map((v) => {
                const isMuted = muted.includes(v)
                const isSolo = solo === v
                const c = VOICE_COLORS[v]
                return (
                  <span key={v} style={{ display: 'inline-flex', border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => setMuted(isMuted ? muted.filter((x) => x !== v) : [...muted, v])}
                      style={{ ...voicePill, color: c.text, opacity: isMuted ? 0.4 : 1, background: c.bg }}>
                      {v}
                    </button>
                    <button onClick={() => setSolo(isSolo ? null : v)} title="Solo"
                      style={{ ...voicePill, padding: '4px 7px', color: isSolo ? '#0A0C16' : c.text, background: isSolo ? c.text : 'transparent', borderLeft: `1px solid ${c.border}` }}>
                      S
                    </button>
                  </span>
                )
              })}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Toggle on={loopOn} onClick={() => setLoopOn(!loopOn)}>Loop</Toggle>
                <Label>bars</Label>
                <input type="number" min={1} max={numMeasures} value={loopStart}
                  onChange={(e) => setLoopStart(Number(e.target.value))} style={{ ...inputStyle, width: 48 }} />
                <span style={{ color: '#52525A' }}>–</span>
                <input type="number" min={1} max={numMeasures} value={loopEnd}
                  onChange={(e) => setLoopEnd(Number(e.target.value))} style={{ ...inputStyle, width: 48 }} />
              </span>
            </div>
          </Card>

          {/* TAB */}
          <Card>
            <SectionTitle n="3" title="Tab" sub="Click a fret to select & edit it. Click empty space to seek playback there." />
            <TabView arrangement={arrangement} currentBeat={player.currentBeat} isPlaying={player.isPlaying}
              onSeek={(b) => player.seek(b)} selected={selected} onSelect={setSelected} />
          </Card>

          {/* FRETBOARD + EDITOR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(220px,1fr)', gap: 20 }} className="gtr-split">
            <Card>
              <SectionTitle n="4" title="Fretboard" inline />
              <div style={{ marginTop: 10 }}>
                <Fretboard arrangement={arrangement} currentBeat={player.currentBeat} />
              </div>
              <Legend />
            </Card>
            <Card>
              <SectionTitle n="5" title="Selected note" inline />
              {selected ? (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ marginBottom: 10 }}>
                    <b style={{ color: VOICE_COLORS[selected.voice].text }}>{noteName(selected.pitch)}</b>
                    <span style={{ color: '#9E9EA6' }}> · {selected.voice} · string {6 - selected.string} · fret {selected.fret}
                      {selected.finger ? ` · finger ${selected.finger}` : ''}{selected.pima ? ` · ${selected.pima}` : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <EditBtn onClick={() => nudgeFret(selected, +1)}>Fret +1 ▲</EditBtn>
                    <EditBtn onClick={() => nudgeFret(selected, -1)}>Fret −1 ▼</EditBtn>
                    <EditBtn onClick={() => moveString(selected, -1)}>String ↑ (keep pitch)</EditBtn>
                    <EditBtn onClick={() => moveString(selected, +1)}>String ↓ (keep pitch)</EditBtn>
                    <EditBtn onClick={() => toggleLock(selected)}>{selected.locked ? '🔒 Locked' : '🔓 Lock'}</EditBtn>
                    <EditBtn onClick={() => deleteNote(selected)} danger>Delete</EditBtn>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6E6E76', fontSize: 13, marginTop: 10 }}>Select a note in the tab to edit its fret, string, or delete it.</p>
              )}
            </Card>
          </div>

          {/* CHORDS + WHY */}
          <Card>
            <SectionTitle n="6" title="Harmony" sub="Tap a chord to try the next-best harmonisation for that bar." />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {arrangement.measures.map((m, i) => (
                <button key={i} onClick={() => cycleChord(i)} style={chordChip} title="Cycle chord options">
                  <span style={{ fontSize: 10, color: '#52525A' }}>bar {i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#a085ff' }}>{m.chord?.symbol ?? '—'}</span>
                </button>
              ))}
            </div>
            {arrangement.annotations.length > 0 && (
              <ul style={{ marginTop: 14, paddingLeft: 18, color: '#9E9EA6', fontSize: 12.5, lineHeight: 1.7 }}>
                {arrangement.annotations.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </Card>

          {/* EXPORT */}
          <Card>
            <SectionTitle n="7" title="Export" inline />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Chip onClick={exportMidi}>Download MIDI</Chip>
              <Chip onClick={exportXml}>Download MusicXML</Chip>
              <Chip onClick={copyTab}>Copy TAB text</Chip>
            </div>
          </Card>
        </>
      )}

      <style>{`@media (max-width: 720px){ .gtr-split{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

// ── Small presentational helpers ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-inset, rgba(255,255,255,0.03))', color: '#EEEEF2',
  border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 8, padding: '6px 8px', fontSize: 13, width: '100%',
}
const primaryBtn: React.CSSProperties = {
  marginTop: 16, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(100,240,170,0.3)',
  background: 'rgba(100,240,170,0.12)', color: '#64f0aa', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
const keyBadge: React.CSSProperties = {
  fontSize: 12, color: '#64f0aa', border: '1px solid rgba(100,240,170,0.3)', borderRadius: 6, padding: '3px 8px',
}
const versionBtn: React.CSSProperties = {
  textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', maxWidth: 210,
}
const transportBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border, rgba(255,255,255,0.1))',
  background: 'rgba(255,255,255,0.04)', color: '#EEEEF2', fontSize: 15, cursor: 'pointer',
}
const voicePill: React.CSSProperties = {
  padding: '4px 9px', fontSize: 11, textTransform: 'capitalize', border: 'none', cursor: 'pointer',
}
const chordChip: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px',
  borderRadius: 8, border: '1px solid rgba(160,133,255,0.2)', background: 'rgba(160,133,255,0.06)', cursor: 'pointer',
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      background: 'var(--bg-card, #1A1A1E)', border: '1px solid var(--border, rgba(255,255,255,0.07))',
      borderRadius: 16, padding: 18,
    }}>{children}</section>
  )
}

function SectionTitle({ n, title, sub, inline }: { n: string; title: string; sub?: string; inline?: boolean }) {
  return (
    <div style={{ marginBottom: inline ? 0 : 4, display: inline ? 'inline-flex' : 'block', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7' }}>
        <span style={{ color: '#64f0aa', marginRight: 8 }}>{n}</span>{title}
      </span>
      {sub && <p style={{ color: '#9E9EA6', fontSize: 13, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: '#9E9EA6', marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: '#6E6E76' }}>{children}</span>
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      {options.map(([v, l]) => <option key={v} value={v} style={{ background: '#1A1A1E' }}>{l}</option>)}
    </select>
  )
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
      background: 'rgba(255,255,255,0.03)', color: '#C9C9D0', fontSize: 12.5, cursor: 'pointer',
    }}>{children}</button>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
      border: `1px solid ${on ? 'rgba(100,240,170,0.4)' : 'var(--border, rgba(255,255,255,0.1))'}`,
      background: on ? 'rgba(100,240,170,0.1)' : 'rgba(255,255,255,0.03)', color: on ? '#64f0aa' : '#9E9EA6',
    }}>{children}</button>
  )
}

function miniBtn(active: boolean): React.CSSProperties {
  return {
    padding: '3px 7px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
    border: `1px solid ${active ? 'rgba(100,240,170,0.4)' : 'var(--border, rgba(255,255,255,0.1))'}`,
    background: active ? 'rgba(100,240,170,0.12)' : 'transparent', color: active ? '#64f0aa' : '#9E9EA6',
  }
}

function EditBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
      border: `1px solid ${danger ? 'rgba(255,130,99,0.3)' : 'var(--border, rgba(255,255,255,0.1))'}`,
      background: danger ? 'rgba(255,130,99,0.08)' : 'rgba(255,255,255,0.03)', color: danger ? '#ff8263' : '#C9C9D0',
    }}>{children}</button>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
      {(['melody', 'bass', 'harmony', 'percussion'] as Voice[]).map((v) => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#9E9EA6', textTransform: 'capitalize' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: VOICE_COLORS[v].bg, border: `1px solid ${VOICE_COLORS[v].border}` }} />
          {v}
        </span>
      ))}
    </div>
  )
}
