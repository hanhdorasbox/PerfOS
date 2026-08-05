// ─── Deterministic music-theory engine ───────────────────────────────────────
//
// Key detection (Krumhansl-Schmuckler), scale membership, chord dictionaries and
// a melody-driven harmoniser. No AI, no randomness — every result is reproducible
// and unit-tested. The optional LLM layer (see lib/guitar/ai) only *suggests*;
// this module is what actually validates and scores.

import type {
  Chord,
  ChordChoice,
  ChordFlavour,
  ChordQuality,
  Key,
  MelodyEvent,
} from './types'

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Keys that read more naturally with flats. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export function noteName(midi: number, preferFlat = false): string {
  const names = preferFlat ? FLAT_NAMES : SHARP_NAMES
  return names[pitchClass(midi)] + octaveOf(midi)
}

export function pcName(pc: number, preferFlat = false): string {
  const names = preferFlat ? FLAT_NAMES : SHARP_NAMES
  return names[((pc % 12) + 12) % 12]
}

// ── Scales ────────────────────────────────────────────────────────────────────

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] // natural minor

export function scaleFor(key: Key): number[] {
  const base = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE
  return base.map((i) => pitchClass(key.tonic + i))
}

export function inScale(pc: number, key: Key): boolean {
  return scaleFor(key).includes(pitchClass(pc))
}

// ── Key detection ───────────────────────────────────────────────────────────
//
// Krumhansl-Kessler tonal hierarchy profiles. We weight each pitch class by the
// total sounding duration of the melody and correlate against all 24 keys.

const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlate(weights: number[], profile: number[], tonic: number): number {
  // Pearson correlation between the rotated profile and observed weights.
  const rotated = profile.map((_, i) => profile[(i - tonic + 12) % 12])
  const n = 12
  const meanW = weights.reduce((a, b) => a + b, 0) / n
  const meanP = rotated.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dw = 0
  let dp = 0
  for (let i = 0; i < n; i++) {
    const a = weights[i] - meanW
    const b = rotated[i] - meanP
    num += a * b
    dw += a * a
    dp += b * b
  }
  if (dw === 0 || dp === 0) return 0
  return num / Math.sqrt(dw * dp)
}

export function detectKey(events: MelodyEvent[]): Key {
  const weights = new Array(12).fill(0)
  for (const e of events) weights[pitchClass(e.pitch)] += e.duration || 1

  let best: Key | null = null
  let bestScore = -Infinity
  for (let tonic = 0; tonic < 12; tonic++) {
    const maj = correlate(weights, KK_MAJOR, tonic)
    const min = correlate(weights, KK_MINOR, tonic)
    if (maj > bestScore) {
      bestScore = maj
      best = makeKey(tonic, 'major')
    }
    if (min > bestScore) {
      bestScore = min
      best = makeKey(tonic, 'minor')
    }
  }
  return best ?? makeKey(0, 'major')
}

export function makeKey(tonic: number, mode: 'major' | 'minor'): Key {
  const preferFlat = FLAT_KEYS.has(SHARP_NAMES[pitchClass(tonic)]) || mode === 'minor'
  return {
    tonic: pitchClass(tonic),
    mode,
    name: `${pcName(tonic, preferFlat)} ${mode}`,
  }
}

// ── Chord dictionary ──────────────────────────────────────────────────────────

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  add9: [0, 4, 7, 14],
}

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  '7': '7',
  maj7: 'maj7',
  min7: 'm7',
  m7b5: 'm7b5',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6',
  add9: 'add9',
}

export function makeChord(root: number, quality: ChordQuality, bass?: number): Chord {
  const r = pitchClass(root)
  const preferFlat = FLAT_KEYS.has(SHARP_NAMES[r])
  let symbol = pcName(r, preferFlat) + QUALITY_SUFFIX[quality]
  if (bass !== undefined && pitchClass(bass) !== r) {
    symbol += '/' + pcName(bass, preferFlat)
  }
  return { root: r, quality, intervals: QUALITY_INTERVALS[quality], symbol, bass }
}

/** The pitch classes contained in a chord. */
export function chordPitchClasses(chord: Chord): number[] {
  return chord.intervals.map((i) => pitchClass(chord.root + i))
}

export function chordContains(chord: Chord, pc: number): boolean {
  return chordPitchClasses(chord).includes(pitchClass(pc))
}

// ── Diatonic harmony ──────────────────────────────────────────────────────────

const MAJOR_TRIAD_QUALITIES: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
const MINOR_TRIAD_QUALITIES: ChordQuality[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']

/** The seven diatonic triads of a key, index 0 = I / i. */
export function diatonicChords(key: Key): Chord[] {
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE
  const quals = key.mode === 'major' ? MAJOR_TRIAD_QUALITIES : MINOR_TRIAD_QUALITIES
  return scale.map((deg, i) => makeChord(pitchClass(key.tonic + deg), quals[i]))
}

/** Harmonic function weight — tonic/subdominant/dominant are "safest". */
function functionBonus(key: Key, chordRoot: number): number {
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE
  const degree = scale.indexOf(pitchClass(chordRoot - key.tonic))
  // I / IV / V (0/3/4) most stable; ii/vi common; vii° / iii weaker.
  const table = [1.0, 0.55, 0.4, 0.85, 0.9, 0.65, 0.3]
  return degree >= 0 ? table[degree] : 0.1
}

/**
 * Harmonise one measure's worth of melody notes. Returns a ranked list of chord
 * choices, each tagged with a musical "flavour" so the UI can offer alternatives.
 *
 * @param notes    melody events within the segment (already filtered to measure)
 * @param key      detected key
 * @param prevRoot previous chord root pitch class, for voice-leading continuity
 */
export function harmoniseSegment(
  notes: MelodyEvent[],
  key: Key,
  prevRoot?: number,
): ChordChoice[] {
  if (notes.length === 0) return []

  // Weight melody notes by duration and reward the downbeat (first note) and the
  // longest note — those are the ones the ear latches onto.
  const weights = new Map<number, number>()
  let maxDur = 0
  notes.forEach((n, idx) => {
    const w = (n.duration || 1) * (idx === 0 ? 1.6 : 1)
    weights.set(pitchClass(n.pitch), (weights.get(pitchClass(n.pitch)) || 0) + w)
    maxDur = Math.max(maxDur, n.duration || 1)
  })
  const downbeatPc = pitchClass(notes[0].pitch)
  const longestPc = pitchClass(
    notes.reduce((a, b) => ((b.duration || 1) > (a.duration || 1) ? b : a)).pitch,
  )

  // Candidate pool: diatonic triads, plus a 7th-chord colour option for each, and
  // the dominant of the key (secondary colour). Keeps everything in-key & playable.
  const candidates: Chord[] = []
  for (const tri of diatonicChords(key)) {
    candidates.push(tri)
    // colour variant
    const seventh: ChordQuality =
      tri.quality === 'maj' ? 'maj7' : tri.quality === 'min' ? 'min7' : tri.quality === 'dim' ? 'm7b5' : '7'
    candidates.push(makeChord(tri.root, seventh))
  }

  const scored: ChordChoice[] = candidates.map((chord) => {
    const pcs = chordPitchClasses(chord)
    let coverage = 0
    let total = 0
    for (const [pc, w] of weights) {
      total += w
      if (pcs.includes(pc)) coverage += w
    }
    const coverageRatio = total > 0 ? coverage / total : 0

    let score = coverageRatio * 3
    // Strongly reward harmonising the downbeat and the longest note as chord tones.
    if (pcs.includes(downbeatPc)) score += 1.4
    if (pcs.includes(longestPc)) score += 1.0
    // Prefer the melody's most-weighted note to be root/third/fifth, not a tension.
    score += functionBonus(key, chord.root) * 0.8
    // Voice-leading: small root motion from the previous chord feels smoother.
    if (prevRoot !== undefined) {
      const motion = Math.min(
        pitchClass(chord.root - prevRoot),
        pitchClass(prevRoot - chord.root),
      )
      score += (6 - motion) * 0.06
      if (chord.root === prevRoot) score -= 0.15 // gently discourage stagnation
    }
    // Triads are a touch safer than 7ths at low complexity; 7ths add colour.
    if (chord.intervals.length === 4) score += 0.05
    return { ...chord, score, flavour: 'safest' }
  })

  scored.sort((a, b) => b.score - a.score)

  // Assign flavours to the top distinct chords so the UI can present alternatives.
  const flavours: ChordFlavour[] = ['safest', 'warmest', 'emotional', 'rhythmic', 'colourful']
  const seen = new Set<string>()
  const ranked: ChordChoice[] = []
  for (const c of scored) {
    if (seen.has(c.symbol)) continue
    seen.add(c.symbol)
    ranked.push({ ...c, flavour: flavours[Math.min(ranked.length, flavours.length - 1)] })
    if (ranked.length >= 5) break
  }
  return ranked
}
