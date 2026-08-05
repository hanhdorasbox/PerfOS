// ─── Arrangement engine ───────────────────────────────────────────────────────
//
// Turns a plain single-note melody into a fuller, *playable* acoustic guitar
// arrangement. This is the hybrid heart of the app:
//
//   1. deterministic theory  (key + chords)          → theory.ts
//   2. fretboard/playability  (positions, voicings)  → fretboard.ts
//   3. arrangement rules      (styles × difficulty)  → this file
//
// The melody is sacred: its pitch and rhythm are preserved. Everything else —
// bass, chord tones, arpeggios, techniques — is added *around* it and validated
// for reachability before it lands in the tab.

import type {
  Arrangement,
  ArrangeOptions,
  ChordChoice,
  Key,
  Measure,
  Melody,
  MelodyEvent,
  TabNote,
  Voice,
} from './types'
import {
  chordPitchClasses,
  detectKey,
  harmoniseSegment,
  makeChord,
  pitchClass,
} from './theory'
import {
  TUNINGS,
  choosePosition,
  chooseBass,
  suggestFinger,
  voiceChordUnder,
} from './fretboard'

// Density knobs that distinguish styles, difficulties and variants.
interface Density {
  bassMode: 'root' | 'root-fifth' | 'alternating'
  harmonyTones: number // chord tones stacked under a melody note
  arpeggiate: boolean
  syncopation: number // 0..1, chance/positions of off-beat hits
  percussion: boolean
  openBias: number // extra reward for open strings
  seventhColour: number // 0 = triads, 1 = allow 7th chords
  fillGaps: boolean // fill melodic rests with arpeggio motion
}

function baseDensity(opts: ArrangeOptions): Density {
  const d = opts.difficulty
  const dens: Density = {
    bassMode: d >= 3 ? 'alternating' : d === 2 ? 'root-fifth' : 'root',
    harmonyTones: Math.min(3, Math.max(0, d - 1)),
    arpeggiate: d >= 2,
    syncopation: d >= 3 ? 0.6 : d === 2 ? 0.3 : 0,
    percussion: d >= 4,
    openBias: 2,
    seventhColour: d >= 3 ? 1 : 0,
    fillGaps: d >= 2,
  }
  switch (opts.style) {
    case 'chord-melody':
      dens.harmonyTones = Math.min(3, dens.harmonyTones + 1)
      dens.arpeggiate = false
      dens.fillGaps = false
      break
    case 'latin-acoustic':
      dens.syncopation = Math.max(dens.syncopation, 0.7)
      dens.arpeggiate = false
      break
    case 'travis':
      dens.bassMode = 'alternating'
      dens.arpeggiate = true
      break
    case 'soft-acoustic':
      dens.harmonyTones = Math.min(dens.harmonyTones, 2)
      dens.arpeggiate = false
      dens.syncopation = 0
      dens.openBias = 3
      dens.fillGaps = false
      break
    case 'simple-fingerstyle':
    default:
      break
  }
  return dens
}

/** A variant is the base density nudged in a musical direction. */
interface Variant {
  label: string
  blurb: string
  mod: (d: Density) => Density
  flavourRank: number // which harmonisation flavour to prefer
}

const VARIANTS: Variant[] = [
  {
    label: 'Simple',
    blurb: 'Melody + a light bass. The easiest to play.',
    flavourRank: 0,
    mod: (d) => ({ ...d, harmonyTones: Math.max(0, d.harmonyTones - 1), arpeggiate: false, percussion: false, syncopation: 0, fillGaps: false }),
  },
  {
    label: 'Balanced',
    blurb: 'Melody, bass and tasteful chord tones — the recommended arrangement.',
    flavourRank: 0,
    mod: (d) => d,
  },
  {
    label: 'Full',
    blurb: 'Richer voicings and arpeggios filling the gaps.',
    flavourRank: 1,
    mod: (d) => ({ ...d, harmonyTones: Math.min(3, d.harmonyTones + 1), arpeggiate: true, fillGaps: true, seventhColour: 1 }),
  },
  {
    label: 'Rhythmic',
    blurb: 'Syncopated hits and light percussion for groove.',
    flavourRank: 3,
    mod: (d) => ({ ...d, syncopation: Math.max(0.6, d.syncopation), percussion: true }),
  },
  {
    label: 'Open-string',
    blurb: 'Leans on ringing open strings and low hand movement.',
    flavourRank: 1,
    mod: (d) => ({ ...d, openBias: d.openBias + 3 }),
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pimaForString(s: number): TabNote['pima'] {
  if (s >= 3) return 'p'
  if (s === 2) return 'i'
  if (s === 1) return 'm'
  return 'a'
}

/** Which string the melody occupies at a given beat within a measure (or -1). */
function melodyStringAt(melody: TabNote[], beat: number): number {
  for (const n of melody) {
    if (beat >= n.start - 1e-6 && beat < n.start + n.duration - 1e-6) return n.string
  }
  return -1
}

function occupiedStringsAt(notes: TabNote[], beat: number): Set<number> {
  const set = new Set<number>()
  for (const n of notes) {
    if (beat >= n.start - 1e-6 && beat < n.start + n.duration - 1e-6) set.add(n.string)
  }
  return set
}

// ── Core arrange ──────────────────────────────────────────────────────────────

function arrangeVariant(
  melody: Melody,
  opts: ArrangeOptions,
  key: Key,
  variant: Variant,
): Arrangement {
  const tuning = TUNINGS[opts.tuning]
  const capo = opts.capo
  const bpm = opts.beatsPerMeasure
  const density = variant.mod(baseDensity(opts))
  const annotations: string[] = []

  const positionPrefs = {
    maxFret: opts.difficulty <= 2 ? 7 : opts.difficulty === 3 ? 10 : 12,
    openBonus: density.openBias,
  }

  // 1) Segment the melody into measures.
  const totalBeats = Math.max(
    bpm,
    ...melody.events.map((e) => e.start + e.duration),
  )
  const numMeasures = Math.max(1, Math.ceil(totalBeats / bpm - 1e-6))
  const measures: Measure[] = []

  let handFret = 0
  let prevRoot: number | undefined
  const allNotes: TabNote[] = []

  for (let m = 0; m < numMeasures; m++) {
    const mStart = m * bpm
    const mEnd = mStart + bpm
    const segEvents = melody.events.filter((e) => e.start >= mStart - 1e-6 && e.start < mEnd - 1e-6)

    // 2) Harmonise this measure.
    const relEvents: MelodyEvent[] = segEvents.map((e) => ({ ...e, start: e.start - mStart }))
    let choices = harmoniseSegment(relEvents, key, prevRoot)
    if (density.seventhColour === 0) {
      // Prefer plain triads when colour is off.
      choices = [
        ...choices.filter((c) => c.intervals.length === 3),
        ...choices.filter((c) => c.intervals.length === 4),
      ]
    }
    const chord: ChordChoice | undefined =
      choices[Math.min(variant.flavourRank, choices.length - 1)] ?? choices[0]
    if (chord) prevRoot = chord.root

    const measureNotes: TabNote[] = []

    // 3) Place the melody (highest voice, high strings, running hand position).
    const melodyNotes: TabNote[] = []
    for (const e of segEvents) {
      const pos = choosePosition(tuning, capo, e.pitch, {
        handFret,
        preferHighStrings: true,
        maxString: 3,
        ...positionPrefs,
      })
      if (!pos) {
        annotations.push(`Melody note ${e.pitch} couldn't be placed within reach; skipped.`)
        continue
      }
      if (pos.string > 2) {
        annotations.push(
          `Melody moved to string ${6 - pos.string} in bar ${m + 1} so it stays reachable.`,
        )
      }
      if (pos.fret > 0) handFret = pos.fret
      const note: TabNote = {
        pitch: e.pitch,
        string: pos.string,
        fret: pos.fret,
        start: e.start,
        duration: e.duration,
        voice: 'melody',
        pima: pimaForString(pos.string),
        velocity: 1,
      }
      melodyNotes.push(note)
    }

    // 3b) Level-3+ hammer-ons / pull-offs on stepwise, same-string melody moves.
    if (opts.difficulty >= 3) {
      for (let i = 1; i < melodyNotes.length; i++) {
        const a = melodyNotes[i - 1]
        const b = melodyNotes[i]
        const gap = b.start - (a.start + a.duration)
        if (a.string === b.string && a.fret > 0 && b.fret > 0 && Math.abs(a.fret - b.fret) <= 2 && gap < 1e-6) {
          b.technique = b.fret > a.fret ? 'hammer' : 'pull'
        }
      }
    }
    measureNotes.push(...melodyNotes)

    // 4) Accompaniment: bass + harmony + arps, guided by the density pattern.
    if (chord) {
      const chordObj = makeChord(chord.root, chord.quality)
      const fifthPc = pitchClass(chord.root + 7)
      const bassBeats = bassPattern(density.bassMode, bpm)

      // 4a) Bass line.
      bassBeats.forEach((bb, idx) => {
        const wantFifth = density.bassMode !== 'root' && idx % 2 === 1
        const rootPc = wantFifth ? fifthPc : chord.root
        const pos = chooseBass(tuning, capo, rootPc, { handFret: Math.max(handFret, 2), maxFret: positionPrefs.maxFret })
        if (!pos) return
        const start = mStart + bb.beat
        if (occupiedStringsAt(measureNotes, start).has(pos.string)) return
        measureNotes.push({
          pitch: tuning.strings[pos.string] + capo + pos.fret,
          string: pos.string,
          fret: pos.fret,
          start,
          duration: bb.dur,
          voice: 'bass',
          pima: 'p',
          velocity: 0.85,
        })
      })

      // 4b) Chord tones under the melody (chord-melody / block styles).
      if (density.harmonyTones > 0 && (opts.style === 'chord-melody' || variant.label === 'Full')) {
        for (const mn of melodyNotes) {
          if (mn.string > 2) continue // only stack under a genuinely high melody note
          const tones = voiceChordUnder(tuning, capo, chordObj, {
            melodyString: mn.string,
            handFret: mn.fret || handFret,
            maxTones: density.harmonyTones,
            lowestString: 4,
            maxFret: positionPrefs.maxFret,
          })
          for (const t of tones) {
            if (occupiedStringsAt(measureNotes, mn.start).has(t.string)) continue
            measureNotes.push({
              pitch: tuning.strings[t.string] + capo + t.fret,
              string: t.string,
              fret: t.fret,
              start: mn.start,
              duration: mn.duration,
              voice: 'harmony',
              pima: pimaForString(t.string),
              velocity: 0.7,
            })
          }
        }
      }

      // 4c) Arpeggios / gap fills on the off-beats.
      if (density.arpeggiate || density.fillGaps) {
        const pcs = chordPitchClasses(chordObj)
        const grid = eighthGrid(bpm)
        let arpIdx = 0
        for (const beat of grid) {
          const abs = mStart + beat
          const melHere = melodyStringAt(melodyNotes, abs)
          const occ = occupiedStringsAt(measureNotes, abs)
          if (melHere >= 0 && !density.fillGaps) continue
          if (occ.size >= (melHere >= 0 ? 3 : 2)) continue
          // Only fill genuine gaps unless we're actively arpeggiating.
          if (melHere >= 0 && melodyStartsAt(melodyNotes, abs)) continue
          const pc = pcs[arpIdx % pcs.length]
          arpIdx++
          const targetPitch = 55 + ((pc - pitchClass(55) + 12) % 12) // around G3 range
          const pos = choosePosition(tuning, capo, targetPitch, {
            handFret,
            minString: melHere >= 0 ? melHere + 1 : 1,
            maxString: 4,
            ...positionPrefs,
          })
          if (!pos || occ.has(pos.string)) continue
          measureNotes.push({
            pitch: tuning.strings[pos.string] + capo + pos.fret,
            string: pos.string,
            fret: pos.fret,
            start: abs,
            duration: 0.5,
            voice: 'harmony',
            pima: pimaForString(pos.string),
            velocity: 0.6,
          })
        }
      }

      // 4d) Syncopated chord hits (Latin / rhythmic).
      if (density.syncopation > 0) {
        for (const beat of syncopatedBeats(bpm)) {
          const abs = mStart + beat
          if (melodyStartsAt(melodyNotes, abs)) continue
          const tones = voiceChordUnder(tuning, capo, chordObj, {
            melodyString: 1,
            handFret,
            maxTones: 3,
            lowestString: 4,
            maxFret: positionPrefs.maxFret,
          })
          const occ = occupiedStringsAt(measureNotes, abs)
          tones.forEach((t, i) => {
            if (occ.has(t.string)) return
            measureNotes.push({
              pitch: tuning.strings[t.string] + capo + t.fret,
              string: t.string,
              fret: t.fret,
              start: abs,
              duration: 0.5,
              voice: 'harmony',
              technique: 'strum-down',
              pima: pimaForString(t.string),
              velocity: 0.65 + i * 0.03,
            })
          })
        }
      }

      // 4e) Percussion — body tap / muted slap on the backbeats.
      if (density.percussion) {
        for (let beat = 1; beat < bpm; beat += 2) {
          measureNotes.push({
            pitch: 0,
            string: 5,
            fret: 0,
            start: mStart + beat,
            duration: 0.5,
            voice: 'percussion',
            technique: 'slap',
            velocity: 0.5,
          })
        }
      }
    }

    // 5) Finger suggestions per simultaneous group.
    assignFingers(measureNotes)

    measureNotes.sort((a, b) => a.start - b.start || b.string - a.string)
    measures.push({ index: m, beats: bpm, notes: measureNotes, chord })
    allNotes.push(...measureNotes)
  }

  allNotes.sort((a, b) => a.start - b.start || b.string - a.string)

  if (annotations.length === 0) {
    annotations.push('Melody preserved exactly; bass and harmony added underneath.')
  }

  return {
    label: variant.label,
    blurb: variant.blurb,
    key,
    tuning,
    capo,
    tempo: opts.tempo,
    beatsPerMeasure: bpm,
    measures,
    notes: allNotes,
    annotations: dedupe(annotations).slice(0, 6),
  }
}

// ── Pattern helpers ─────────────────────────────────────────────────────────

function bassPattern(mode: Density['bassMode'], bpm: number): { beat: number; dur: number }[] {
  if (mode === 'alternating') {
    return Array.from({ length: bpm }, (_, i) => ({ beat: i, dur: 1 }))
  }
  if (mode === 'root-fifth') {
    const beats = bpm >= 4 ? [0, 2] : [0]
    return beats.map((b) => ({ beat: b, dur: bpm >= 4 ? 2 : bpm }))
  }
  return [{ beat: 0, dur: bpm }]
}

function eighthGrid(bpm: number): number[] {
  const out: number[] = []
  for (let b = 0; b < bpm; b += 0.5) out.push(b)
  return out
}

function syncopatedBeats(bpm: number): number[] {
  // Classic acoustic/Latin push: the "and" of 2, beat 3, the "and" of 3/4.
  return bpm >= 4 ? [1.5, 2.5, 3.5] : [1.5, 2.5]
}

function melodyStartsAt(melody: TabNote[], absBeat: number): boolean {
  return melody.some((n) => Math.abs(n.start - absBeat) < 1e-6)
}

function assignFingers(notes: TabNote[]): void {
  const groups = new Map<number, TabNote[]>()
  for (const n of notes) {
    if (n.voice === 'percussion' || n.fret === 0) continue
    const key = Math.round(n.start * 8)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }
  for (const group of groups.values()) {
    const minFret = Math.min(...group.map((n) => n.fret))
    for (const n of group) n.finger = suggestFinger(n.fret, minFret)
  }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Generate all arrangement variants from a parsed melody. */
export function generateArrangements(melody: Melody, opts: ArrangeOptions): {
  key: Key
  variants: Arrangement[]
} {
  const key = detectKey(melody.events)
  const variants = VARIANTS.map((v) => arrangeVariant(melody, opts, key, v))
  return { key, variants }
}

/** Generate a single arrangement (the balanced/default variant). */
export function generateArrangement(melody: Melody, opts: ArrangeOptions): Arrangement {
  const { key } = { key: detectKey(melody.events) }
  return arrangeVariant(melody, opts, key, VARIANTS[1])
}

export const VARIANT_LABELS = VARIANTS.map((v) => v.label)
export type { Voice }
