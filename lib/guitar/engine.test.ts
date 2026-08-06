import { describe, it, expect } from 'vitest'
import {
  TUNINGS,
  parseTab,
  renderTab,
  detectKey,
  harmoniseSegment,
  makeKey,
  diatonicChords,
  chordContains,
  generateArrangements,
  generateArrangement,
  toMidi,
  toMusicXml,
  pitchAt,
  choosePosition,
  yinPitch,
  transcribe,
  melodyToTab,
  nameToMidi,
  songToMelody,
  findSongs,
  SONG_LIBRARY,
  EXAMPLE_TAB,
  EXAMPLE_ODE,
} from './index'
import type { ArrangeOptions } from './types'

const std = TUNINGS.standard

const opts = (over: Partial<ArrangeOptions> = {}): ArrangeOptions => ({
  style: 'simple-fingerstyle',
  difficulty: 2,
  tuning: 'standard',
  capo: 0,
  tempo: 90,
  beatsPerMeasure: 4,
  strictness: 'exact',
  ...over,
})

describe('fretboard', () => {
  it('computes open string pitches (standard tuning)', () => {
    expect(pitchAt(std, 0, 0, 0)).toBe(64) // high e = E4
    expect(pitchAt(std, 0, 5, 0)).toBe(40) // low E = E2
    expect(pitchAt(std, 0, 5, 3)).toBe(43) // G on low E string
  })

  it('applies a capo', () => {
    expect(pitchAt(std, 2, 0, 0)).toBe(66) // capo 2 raises high e to F#4
  })

  it('chooses a reachable position', () => {
    const pos = choosePosition(std, 0, 64, { handFret: 0, preferHighStrings: true })
    expect(pos).not.toBeNull()
    expect(pitchAt(std, 0, pos!.string, pos!.fret)).toBe(64)
  })
})

describe('tab parser', () => {
  it('parses the example melody into pitched events', () => {
    const mel = parseTab(EXAMPLE_TAB, std, 0)
    expect(mel.events.length).toBe(3)
    // D string fret 7 = A3(57), G string 7 = D4(62), G string 9 = E4(64)
    expect(mel.events.map((e) => e.pitch)).toEqual([57, 62, 64])
    // starts should be strictly increasing
    for (let i = 1; i < mel.events.length; i++) {
      expect(mel.events[i].start).toBeGreaterThan(mel.events[i - 1].start)
    }
  })

  it('round-trips through renderTab without throwing and keeps 6 lines', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts())
    const rendered = renderTab(arr.notes, arr.beatsPerMeasure)
    expect(rendered.split('\n').length).toBe(6)
    expect(rendered).toContain('|')
  })
})

describe('theory', () => {
  it('detects C major from a C major scale', () => {
    const events = [0, 2, 4, 5, 7, 9, 11, 12].map((p, i) => ({
      pitch: 60 + p,
      start: i,
      duration: 1,
    }))
    const key = detectKey(events)
    expect(key.tonic).toBe(0)
    expect(key.mode).toBe('major')
  })

  it('builds diatonic chords of C major', () => {
    const chords = diatonicChords(makeKey(0, 'major'))
    expect(chords[0].symbol).toBe('C')
    expect(chords[1].symbol).toBe('Dm')
    expect(chords[4].symbol).toBe('G')
  })

  it('harmonises a melody note with a chord that contains it', () => {
    const key = makeKey(0, 'major')
    const choices = harmoniseSegment([{ pitch: 64, start: 0, duration: 2 }], key) // E
    expect(choices.length).toBeGreaterThan(0)
    expect(chordContains(choices[0], 64)).toBe(true)
  })
})

describe('arranger', () => {
  it('preserves every melody pitch (strictness: exact)', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts({ difficulty: 3 }))
    const melodyPitches = arr.notes.filter((n) => n.voice === 'melody').map((n) => n.pitch).sort()
    const originalPitches = [...mel.events.map((e) => e.pitch)].sort()
    expect(melodyPitches).toEqual(originalPitches)
  })

  it('adds bass and harmony beyond the melody', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts({ difficulty: 3 }))
    expect(arr.notes.some((n) => n.voice === 'bass')).toBe(true)
    expect(arr.notes.length).toBeGreaterThan(mel.events.length)
  })

  it('every generated note is physically on the fretboard', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts({ difficulty: 4, style: 'chord-melody' }))
    for (const n of arr.notes) {
      if (n.voice === 'percussion') continue
      expect(n.fret).toBeGreaterThanOrEqual(0)
      expect(n.fret).toBeLessThanOrEqual(15)
      expect(pitchAt(arr.tuning, arr.capo, n.string, n.fret)).toBe(n.pitch)
    }
  })

  it('never stacks two notes on the same string at the same instant (multi-measure)', () => {
    // A three-bar melody so measures after the first are exercised too.
    const longTab = `e|--0--2--3--5--3--2--0--2--3--5--7--5--3--2--0-------|
B|---------------------------------------------------|
G|---------------------------------------------------|
D|---------------------------------------------------|
A|---------------------------------------------------|
E|---------------------------------------------------|`
    const mel = parseTab(longTab, std, 0)
    for (const style of ['simple-fingerstyle', 'chord-melody', 'latin-acoustic', 'travis'] as const) {
      for (let d = 1; d <= 5; d++) {
        const arr = generateArrangement(mel, opts({ style, difficulty: d }))
        const seen = new Map<string, number>()
        for (const n of arr.notes) {
          if (n.voice === 'percussion') continue
          const t = Math.round(n.start * 8)
          const k = `${n.string}@${t}`
          seen.set(k, (seen.get(k) ?? 0) + 1)
          expect(seen.get(k), `collision ${k} in ${style} L${d}`).toBeLessThanOrEqual(1)
          expect(pitchAt(arr.tuning, arr.capo, n.string, n.fret)).toBe(n.pitch)
        }
        expect(arr.measures.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('generates five distinct variants', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const { variants, key } = generateArrangements(mel, opts())
    expect(variants.length).toBe(5)
    expect(key.name).toBeTruthy()
    const labels = variants.map((v) => v.label)
    expect(new Set(labels).size).toBe(5)
  })

  it('higher difficulty adds more notes than lower', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const easy = generateArrangement(mel, opts({ difficulty: 1 }))
    const hard = generateArrangement(mel, opts({ difficulty: 4, style: 'chord-melody' }))
    expect(hard.notes.length).toBeGreaterThanOrEqual(easy.notes.length)
  })
})

describe('multi-system tab parsing', () => {
  it('parses stacked tab blocks in time order (a whole song, not just the last block)', () => {
    const twoSystems = `e|--0--2--3--|
B|-----------|
G|-----------|
D|-----------|
A|-----------|
E|-----------|

e|--5--3--2--0--|
B|--------------|
G|--------------|
D|--------------|
A|--------------|
E|--------------|`
    const mel = parseTab(twoSystems, std, 0)
    // 3 notes in the first block + 4 in the second = 7, and the second block's
    // notes must start after the first block's (offset by a whole measure).
    expect(mel.events.length).toBe(7)
    const firstBlockEnd = Math.max(...mel.events.slice(0, 3).map((e) => e.start))
    const secondBlockStart = Math.min(...mel.events.slice(3).map((e) => e.start))
    expect(secondBlockStart).toBeGreaterThan(firstBlockEnd)
  })
})

describe('song library', () => {
  it('parses scientific pitch names to MIDI', () => {
    expect(nameToMidi('C4')).toBe(60)
    expect(nameToMidi('A4')).toBe(69)
    expect(nameToMidi('F#3')).toBe(54)
    expect(nameToMidi('Bb4')).toBe(70)
    expect(nameToMidi('nonsense')).toBeNull()
  })

  it('converts every library song into a non-empty, arrangeable melody', () => {
    expect(SONG_LIBRARY.length).toBeGreaterThan(8)
    for (const song of SONG_LIBRARY) {
      const melody = songToMelody(song)
      expect(melody.events.length, song.title).toBeGreaterThan(4)
      // starts strictly non-decreasing
      for (let i = 1; i < melody.events.length; i++) {
        expect(melody.events[i].start).toBeGreaterThanOrEqual(melody.events[i - 1].start)
      }
      // and it produces a valid arrangement
      const arr = generateArrangement(melody, opts({ beatsPerMeasure: song.beatsPerMeasure, tempo: song.tempo }))
      expect(arr.notes.length).toBeGreaterThan(melody.events.length)
    }
  })

  it('finds songs by name (case-insensitive substring)', () => {
    expect(findSongs('twinkle').some((s) => s.id === 'twinkle')).toBe(true)
    expect(findSongs('JINGLE').some((s) => s.id === 'jingle-bells')).toBe(true)
    expect(findSongs('zzznope').length).toBe(0)
    expect(findSongs('').length).toBe(SONG_LIBRARY.length)
  })
})

describe('pitch detection & transcription', () => {
  const SR = 44100
  function sine(freq: number, seconds: number, sr = SR): Float32Array {
    const n = Math.floor(seconds * sr)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sr) * 0.8
    return out
  }

  it('YIN detects the pitch of a pure tone within a few cents', () => {
    const frame = sine(220, 0.05).subarray(0, 2048)
    const { f0, confidence } = yinPitch(frame, SR)
    expect(confidence).toBeGreaterThan(0.8)
    expect(Math.abs(f0 - 220)).toBeLessThan(3) // < ~25 cents
  })

  it('YIN reports unvoiced on silence', () => {
    const { f0 } = yinPitch(new Float32Array(2048), SR)
    expect(f0).toBe(0)
  })

  it('transcribes a two-note tone sequence into two melody events', () => {
    // A4 (440) then C#5 (554) — a major third, half a second each.
    const a = sine(440, 0.5)
    const b = sine(554.37, 0.5)
    const buf = new Float32Array(a.length + b.length)
    buf.set(a, 0)
    buf.set(b, a.length)
    const melody = transcribe(buf, SR, { tempo: 120 })
    expect(melody.events.length).toBeGreaterThanOrEqual(2)
    const pitches = melody.events.map((e) => e.pitch)
    expect(pitches).toContain(69) // A4
    expect(pitches).toContain(73) // C#5
    // And it round-trips into a renderable tab.
    const tab = melodyToTab(melody, std, 0)
    expect(tab.split('\n').length).toBe(6)
  })
})

describe('exporters', () => {
  it('produces a valid-looking MIDI header', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts())
    const midi = toMidi(arr)
    // "MThd"
    expect([midi[0], midi[1], midi[2], midi[3]]).toEqual([0x4d, 0x54, 0x68, 0x64])
    expect(midi.length).toBeGreaterThan(30)
  })

  it('produces MusicXML with a part and measures', () => {
    const mel = parseTab(EXAMPLE_ODE, std, 0)
    const arr = generateArrangement(mel, opts())
    const xml = toMusicXml(arr)
    expect(xml).toContain('<score-partwise')
    expect(xml).toContain('<measure number="1">')
    expect(xml).toContain('Acoustic Guitar')
  })
})
