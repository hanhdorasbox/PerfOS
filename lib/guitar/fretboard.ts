// ─── Fretboard & tuning engine ────────────────────────────────────────────────
//
// Maps pitches to physical string/fret positions and chooses the *best* position
// given the current hand, difficulty and acoustic-first preferences (open strings,
// low movement, melody kept on the top strings). Also renders playable chord
// voicings underneath a melody note.

import type { Chord, Tuning, TuningName, TabNote } from './types'
import { chordPitchClasses, pitchClass } from './theory'

export const TUNINGS: Record<TuningName, Tuning> = {
  // strings[0] is the HIGHEST string (thin e), strings[5] the lowest (thick E).
  standard: { name: 'standard', label: 'Standard (E A D G B e)', strings: [64, 59, 55, 50, 45, 40] },
  'drop-d': { name: 'drop-d', label: 'Drop D (D A D G B e)', strings: [64, 59, 55, 50, 45, 38] },
  dadgad: { name: 'dadgad', label: 'DADGAD', strings: [62, 57, 55, 50, 45, 38] },
  'open-d': { name: 'open-d', label: 'Open D (D A D F# A D)', strings: [62, 57, 54, 50, 45, 38] },
  'open-g': { name: 'open-g', label: 'Open G (D G D G B D)', strings: [62, 59, 55, 50, 43, 38] },
  'open-c': { name: 'open-c', label: 'Open C (C G C G C E)', strings: [64, 60, 55, 48, 43, 36] },
}

const MAX_FRET = 15

export interface FretPos {
  string: number
  fret: number
}

/** The sounding MIDI pitch of a string/fret given a tuning and capo. */
export function pitchAt(tuning: Tuning, capo: number, string: number, fret: number): number {
  return tuning.strings[string] + capo + fret
}

/** All string/fret positions (respecting the capo) that produce a pitch. */
export function positionsForPitch(tuning: Tuning, capo: number, pitch: number): FretPos[] {
  const out: FretPos[] = []
  for (let s = 0; s < tuning.strings.length; s++) {
    const fret = pitch - (tuning.strings[s] + capo)
    if (fret >= 0 && fret <= MAX_FRET) out.push({ string: s, fret })
  }
  return out
}

export interface PositionPrefs {
  /** Roughly where the hand currently is (fret). Positions near it are cheaper. */
  handFret: number
  /** Keep melody on the high strings so it stays audible above accompaniment. */
  preferHighStrings?: boolean
  /** Highest string index that may be used (e.g. reserve low strings for bass). */
  minString?: number
  /** Lowest string index that may be used (reserve high strings for melody). */
  maxString?: number
  /** Reward open strings more strongly (soft/resonant styles). */
  openBonus?: number
  maxFret?: number
}

/** Choose the single best playable position for a pitch. */
export function choosePosition(
  tuning: Tuning,
  capo: number,
  pitch: number,
  prefs: PositionPrefs,
): FretPos | null {
  const maxFret = prefs.maxFret ?? 12
  const candidates = positionsForPitch(tuning, capo, pitch).filter((p) => {
    if (p.fret > maxFret) return false
    if (prefs.minString !== undefined && p.string < prefs.minString) return false
    if (prefs.maxString !== undefined && p.string > prefs.maxString) return false
    return true
  })
  if (candidates.length === 0) {
    // Fall back to anything on the neck rather than dropping the note entirely.
    const all = positionsForPitch(tuning, capo, pitch)
    return all.length ? all.sort((a, b) => a.fret - b.fret)[0] : null
  }

  let best: FretPos | null = null
  let bestCost = Infinity
  for (const c of candidates) {
    let cost = 0
    cost += Math.abs(c.fret - prefs.handFret) // hand travel
    if (c.fret === 0) cost -= prefs.openBonus ?? 2 // open strings ring & are free
    if (prefs.preferHighStrings) cost += c.string * 0.6 // keep melody up top
    else cost += Math.abs(c.string - 2) * 0.15 // otherwise prefer the middle
    cost += c.fret * 0.05 // marginally prefer lower positions
    if (cost < bestCost) {
      bestCost = cost
      best = c
    }
  }
  return best
}

/**
 * Choose a bass position for a pitch class low on the neck (strings 3..5).
 * Returns the lowest comfortable octave of that pitch class.
 */
export function chooseBass(
  tuning: Tuning,
  capo: number,
  rootPc: number,
  prefs: { handFret: number; maxFret?: number },
): FretPos | null {
  const maxFret = prefs.maxFret ?? 12
  let best: FretPos | null = null
  let bestCost = Infinity
  for (let s = 5; s >= 3; s--) {
    // Find the lowest fret on this bass string that yields the pitch class.
    const open = tuning.strings[s] + capo
    for (let fret = 0; fret <= maxFret; fret++) {
      if (pitchClass(open + fret) !== pitchClass(rootPc)) continue
      let cost = Math.abs(fret - prefs.handFret) + (5 - s) * 0.4
      if (fret === 0) cost -= 2
      if (cost < bestCost) {
        bestCost = cost
        best = { string: s, fret }
      }
      break // lowest fret on this string is enough
    }
  }
  return best
}

/**
 * Build a set of chord-tone positions to stack *underneath* a melody note on the
 * given strings, choosing frets close to the hand and preferring the chord's
 * essential tones (root, third, seventh) on higher strings.
 */
export function voiceChordUnder(
  tuning: Tuning,
  capo: number,
  chord: Chord,
  opts: {
    melodyString: number
    handFret: number
    maxTones: number
    lowestString?: number // don't voice below this (keep room for a bass note)
    maxFret?: number
  },
): FretPos[] {
  const maxFret = opts.maxFret ?? 12
  const pcs = chordPitchClasses(chord)
  const lowest = opts.lowestString ?? 5
  const out: FretPos[] = []
  // Fill strings just below the melody, one chord tone per string, closest fret.
  for (let s = opts.melodyString + 1; s <= lowest && out.length < opts.maxTones; s++) {
    let best: FretPos | null = null
    let bestCost = Infinity
    for (const pc of pcs) {
      const open = tuning.strings[s] + capo
      for (let fret = 0; fret <= maxFret; fret++) {
        if (pitchClass(open + fret) !== pc) continue
        let cost = Math.abs(fret - opts.handFret)
        if (fret === 0) cost -= 2
        // prefer root & third of the chord to be present
        const interval = pitchClass(pc - chord.root)
        if (interval === 0) cost -= 1.2
        else if (interval === 4 || interval === 3) cost -= 0.9
        else if (interval === 10 || interval === 11) cost -= 0.4
        if (cost < bestCost) {
          bestCost = cost
          best = { string: s, fret }
        }
        break
      }
    }
    if (best) out.push(best)
  }
  return out
}

/** Suggest a left-hand finger for a note relative to the lowest fretted fret. */
export function suggestFinger(fret: number, minFrettedFret: number): number | 'T' | undefined {
  if (fret === 0) return undefined // open string
  const rel = fret - minFrettedFret
  if (rel <= 0) return 1
  if (rel === 1) return 2
  if (rel === 2) return 3
  return 4
}

/** Detect whether a group of simultaneous notes forms a chord needing a name. */
export function estimateHandFret(notes: TabNote[]): number {
  const fretted = notes.filter((n) => n.fret > 0)
  if (fretted.length === 0) return 0
  return Math.round(fretted.reduce((a, n) => a + n.fret, 0) / fretted.length)
}
