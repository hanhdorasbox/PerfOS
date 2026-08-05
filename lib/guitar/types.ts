// ─── Core types for the acoustic guitar arrangement engine ────────────────────
//
// Everything is deterministic, pure, and framework-free so it can be unit-tested
// and reused by both the UI and (future) API layers. Pitch is always a MIDI note
// number (C4 = 60). Durations are measured in quarter-note "beats" (a float; an
// eighth note is 0.5, a dotted quarter 1.5, and so on).

/** A single sounding note placed on a specific string/fret at a moment in time. */
export interface TabNote {
  /** MIDI pitch (C4 = 60). */
  pitch: number
  /** String index: 0 = highest (thin e), 5 = lowest (thick E) in 6-string tuning. */
  string: number
  /** Fret number relative to the capo (0 = open / capo). */
  fret: number
  /** Start time in quarter-note beats from the top of the piece. */
  start: number
  /** Duration in quarter-note beats. */
  duration: number
  /** Musical role — drives colouring, soloing and playback mixing. */
  voice: Voice
  /** Optional left-hand finger (1-4, or 'T' for thumb-over). */
  finger?: number | 'T'
  /** Optional right-hand finger in p-i-m-a notation. */
  pima?: 'p' | 'i' | 'm' | 'a'
  /** Optional articulation / technique applied to this note. */
  technique?: Technique
  /** Relative loudness 0..1 used by the synth (accents, ghost notes). */
  velocity?: number
  /** User-locked note — protected from regeneration. */
  locked?: boolean
}

export type Voice = 'melody' | 'bass' | 'harmony' | 'percussion'

export type Technique =
  | 'hammer'
  | 'pull'
  | 'slide'
  | 'harmonic'
  | 'palm-mute'
  | 'dead'
  | 'slap'
  | 'strum-down'
  | 'strum-up'

/** One measure of the arrangement. */
export interface Measure {
  index: number
  /** Beats per measure (numerator of the time signature). */
  beats: number
  /** Notes belonging to this measure, sorted by start then string. */
  notes: TabNote[]
  /** The chord chosen to harmonise this measure, if any. */
  chord?: ChordChoice
}

/** A named chord with its constituent pitch classes. */
export interface Chord {
  /** Root pitch class 0..11 (0 = C). */
  root: number
  /** Chord quality symbol, e.g. 'maj', 'min', '7', 'maj7', 'min7', 'sus4'. */
  quality: ChordQuality
  /** Intervals above the root, in semitones. */
  intervals: number[]
  /** Display symbol, e.g. "Cmaj7", "G/B". */
  symbol: string
  /** Optional bass pitch class for slash chords. */
  bass?: number
}

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | '7'
  | 'maj7'
  | 'min7'
  | 'm7b5'
  | 'sus2'
  | 'sus4'
  | '6'
  | 'add9'

/** A chord ranked by the harmoniser, tagged with a human "flavour". */
export interface ChordChoice extends Chord {
  score: number
  flavour: ChordFlavour
}

export type ChordFlavour =
  | 'safest'
  | 'warmest'
  | 'emotional'
  | 'rhythmic'
  | 'colourful'

export interface Key {
  tonic: number // pitch class 0..11
  mode: 'major' | 'minor'
  name: string // e.g. "G major"
}

export type TuningName =
  | 'standard'
  | 'drop-d'
  | 'dadgad'
  | 'open-d'
  | 'open-g'
  | 'open-c'

export interface Tuning {
  name: TuningName
  label: string
  /** Open-string MIDI pitches, index 0 = highest string. */
  strings: number[]
}

export type ArrangementStyle =
  | 'simple-fingerstyle'
  | 'chord-melody'
  | 'latin-acoustic'
  | 'travis'
  | 'soft-acoustic'

export type MelodyStrictness = 'exact' | 'flexible' | 'free'

export interface ArrangeOptions {
  style: ArrangementStyle
  /** 1..5 difficulty. */
  difficulty: number
  tuning: TuningName
  capo: number
  tempo: number // BPM
  beatsPerMeasure: number // default 4
  strictness: MelodyStrictness
}

/** A fully generated arrangement variant. */
export interface Arrangement {
  /** Short label shown in the UI, e.g. "Balanced". */
  label: string
  /** One-line description of what makes this variant distinct. */
  blurb: string
  key: Key
  tuning: Tuning
  capo: number
  tempo: number
  beatsPerMeasure: number
  measures: Measure[]
  /** Flattened, time-sorted notes for playback. */
  notes: TabNote[]
  /** Human-readable notes about decisions (melody moves, technique picks). */
  annotations: string[]
}

/** The parsed melody: a straight monophonic (mostly) sequence of pitched events. */
export interface MelodyEvent {
  pitch: number
  start: number // beats
  duration: number // beats
}

export interface Melody {
  events: MelodyEvent[]
  beatsPerMeasure: number
}
