// ─── Built-in song library ────────────────────────────────────────────────────
//
// Type a song name, pick it, and get a melody to arrange. These are all
// traditional / public-domain tunes, encoded as compact note strings so we can
// ship them legally and offline. (Copyrighted pop songs can't be looked up by
// name — there's no legal, reliable melody-by-name source — so the library is
// curated rather than "any song ever".)
//
// Note DSL: whitespace-separated tokens "Note:beats", e.g. "C4:1 F#3:0.5 R:1".
// A bare "C4" means one beat; "R" is a rest. "|" bar markers are ignored.

import type { Melody, MelodyEvent } from './types'

export interface Song {
  id: string
  title: string
  subtitle?: string
  tempo: number
  beatsPerMeasure: number
  notes: string
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Parse scientific pitch ("C4", "F#3", "Bb4") to a MIDI number, or null. */
export function nameToMidi(name: string): number | null {
  const m = name.match(/^([A-Ga-g])([#b]?)(-?\d)$/)
  if (!m) return null
  const step = PC[m[1].toUpperCase()]
  if (step === undefined) return null
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  const octave = parseInt(m[3], 10)
  return (octave + 1) * 12 + step + alter
}

/**
 * Parse the note DSL ("C4:1 F#3:0.5 R:1 …") into a rhythmic melody. Shared by
 * the built-in library and the image/AI transcription endpoint.
 */
export function notesStringToMelody(notes: string, beatsPerMeasure: number): Melody {
  const events: MelodyEvent[] = []
  let start = 0
  for (const tokenRaw of notes.trim().split(/\s+/)) {
    const token = tokenRaw.replace(/\|/g, '')
    if (!token) continue
    const [pitchPart, durPart] = token.split(':')
    const duration = durPart ? parseFloat(durPart) : 1
    if (!duration || duration <= 0) continue
    if (pitchPart.toUpperCase() === 'R') {
      start += duration
      continue
    }
    const midi = nameToMidi(pitchPart)
    if (midi != null) events.push({ pitch: midi, start, duration })
    start += duration
  }
  return { events, beatsPerMeasure }
}

/** Convert a library song into a rhythmic melody the arranger can use. */
export function songToMelody(song: Song): Melody {
  return notesStringToMelody(song.notes, song.beatsPerMeasure)
}

// Melodies transcribed to their most recognisable phrases. Pitch-accurate;
// rhythm kept simple and singable.
export const SONG_LIBRARY: Song[] = [
  {
    id: 'ode-to-joy', title: 'Ode to Joy', subtitle: 'Beethoven', tempo: 100, beatsPerMeasure: 4,
    notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2',
  },
  {
    id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', subtitle: 'also “ABC” / “Baa Baa Black Sheep”', tempo: 100, beatsPerMeasure: 4,
    notes: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2',
  },
  {
    id: 'mary-lamb', title: 'Mary Had a Little Lamb', tempo: 104, beatsPerMeasure: 4,
    notes: 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:2',
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells', subtitle: 'chorus', tempo: 120, beatsPerMeasure: 4,
    notes: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2',
  },
  {
    id: 'happy-birthday', title: 'Happy Birthday to You', tempo: 108, beatsPerMeasure: 3,
    notes: 'C4:0.75 C4:0.25 D4 C4 F4 E4:2 C4:0.75 C4:0.25 D4 C4 G4 F4:2 C4:0.75 C4:0.25 C5 A4 F4 E4 D4 Bb4:0.75 Bb4:0.25 A4 F4 G4 F4:2',
  },
  {
    id: 'frere-jacques', title: 'Frère Jacques', subtitle: '“Are You Sleeping?”', tempo: 112, beatsPerMeasure: 4,
    notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2',
  },
  {
    id: 'when-saints', title: 'When the Saints Go Marching In', tempo: 116, beatsPerMeasure: 4,
    notes: 'C4 E4 F4 G4:3 C4 E4 F4 G4:3 C4 E4 F4 G4:2 E4 C4 E4 D4:3 E4 E4 D4 C4:2 C4 E4 G4 G4 F4:2 E4 C4 D4 C4:3',
  },
  {
    id: 'london-bridge', title: 'London Bridge Is Falling Down', tempo: 112, beatsPerMeasure: 4,
    notes: 'G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4:2 G4 E4 C4:2',
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald Had a Farm', tempo: 116, beatsPerMeasure: 4,
    notes: 'G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:2 D4 G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:2',
  },
  {
    id: 'row-boat', title: 'Row, Row, Row Your Boat', tempo: 108, beatsPerMeasure: 4,
    notes: 'C4:1 C4:1 C4:0.75 D4:0.25 E4:1 E4:0.75 D4:0.25 E4:0.75 F4:0.25 G4:2 C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 G4:0.75 F4:0.25 E4:0.75 D4:0.25 C4:2',
  },
  {
    id: 'silent-night', title: 'Silent Night', subtitle: 'first phrase', tempo: 96, beatsPerMeasure: 3,
    notes: 'G4:1.5 A4:0.5 G4 E4:3 G4:1.5 A4:0.5 G4 E4:3 D5:2 D5 B4:3 C5:2 C5 G4:3',
  },
  {
    id: 'amazing-grace', title: 'Amazing Grace', tempo: 90, beatsPerMeasure: 3,
    notes: 'D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:2 E4:1 D4:3 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 D5:3 D5:1 B4:2 D5:0.5 B4:0.5 D5:2 B4:1 G4:2 E4:1 D4:3 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:3',
  },
]

export function findSongs(query: string): Song[] {
  const q = query.trim().toLowerCase()
  if (!q) return SONG_LIBRARY
  return SONG_LIBRARY.filter(
    (s) => s.title.toLowerCase().includes(q) || (s.subtitle?.toLowerCase().includes(q) ?? false),
  )
}
