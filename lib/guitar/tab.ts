// ─── ASCII TAB parsing & rendering ────────────────────────────────────────────
//
// parseTab: a plain six-line ASCII tab (mostly single-note melody) → a rhythmic
// monophonic/polyphonic MelodyEvent sequence. Rhythm is inferred from horizontal
// spacing: the smallest gap between note columns is treated as the base note value
// (an eighth note by default), so evenly spaced notes stay even and wide gaps
// become longer notes.
//
// renderTab: structured TabNotes → a clean, copy-pasteable six-string tab, laid
// out on a fixed 16th-note grid with bar lines.

import type { Melody, MelodyEvent, TabNote, Tuning } from './types'
import { pitchAt, choosePosition } from './fretboard'

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] // index 0 = highest

interface RawNote {
  string: number
  col: number
  fret: number
}

const isTabLine = (l: string): boolean =>
  /[-]/.test(l) && /^\s*[a-gA-G#]?\s*\|?[-\d|hpb/\\~*x().\s]+$/.test(l)

/**
 * Split pasted text into "systems" — each a group of up to 6 stacked string
 * lines. A full song is usually written as several such blocks under each other;
 * we parse them all and lay them end to end, so nothing gets dropped.
 */
function extractSystems(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n')
  const runs: string[][] = []
  let cur: string[] = []
  for (const l of lines) {
    if (isTabLine(l)) {
      cur.push(l)
    } else if (cur.length) {
      runs.push(cur)
      cur = []
    }
  }
  if (cur.length) runs.push(cur)
  // A run should be the 6 strings; if a block runs long, chunk it by 6.
  const systems: string[][] = []
  for (const run of runs) {
    for (let i = 0; i < run.length; i += 6) systems.push(run.slice(i, i + 6))
  }
  return systems.filter((s) => s.length > 0)
}

/** Strip the "e|" style label so remaining content is column-aligned across strings. */
function stripLabel(line: string): string {
  const bar = line.indexOf('|')
  if (bar >= 0 && bar <= 4) return line.slice(bar + 1)
  return line
}

/**
 * Parse a six-line ASCII tab into a rhythmic melody.
 *
 * @param baseBeats duration in quarter-note beats assigned to the smallest gap
 *                  (0.5 = eighth note by default).
 */
export function parseTab(
  text: string,
  tuning: Tuning,
  capo: number,
  opts: { baseBeats?: number; beatsPerMeasure?: number } = {},
): Melody {
  const baseBeats = opts.baseBeats ?? 0.5
  const beatsPerMeasure = opts.beatsPerMeasure ?? 4

  const systems = extractSystems(text)
  if (systems.length === 0) return { events: [], beatsPerMeasure }

  // Parse each system, then lay them end to end, snapping each to a bar line so
  // the measures stay aligned across the whole song.
  const allEvents: MelodyEvent[] = []
  let offset = 0
  for (const sys of systems) {
    const content = sys.map((r) => stripLabel(r).replace(/\|/g, '-'))
    const { events, totalBeats } = parseSystem(content, tuning, capo, baseBeats, beatsPerMeasure)
    for (const e of events) allEvents.push({ ...e, start: e.start + offset })
    offset += totalBeats
  }

  allEvents.sort((a, b) => a.start - b.start || b.pitch - a.pitch)
  return { events: allEvents, beatsPerMeasure }
}

/** Parse one system (up to 6 already-label-stripped lines) into relative events. */
function parseSystem(
  content: string[],
  tuning: Tuning,
  capo: number,
  baseBeats: number,
  beatsPerMeasure: number,
): { events: MelodyEvent[]; totalBeats: number } {
  const raw: RawNote[] = []
  content.forEach((line, stringIdx) => {
    let i = 0
    while (i < line.length) {
      const ch = line[i]
      if (ch >= '0' && ch <= '9') {
        let j = i
        while (j < line.length && line[j] >= '0' && line[j] <= '9') j++
        raw.push({ string: stringIdx, col: i, fret: parseInt(line.slice(i, j), 10) })
        i = j
      } else {
        i++
      }
    }
  })
  if (raw.length === 0) return { events: [], totalBeats: 0 }

  // Determine the timing grid from horizontal spacing between note columns.
  const cols = Array.from(new Set(raw.map((r) => r.col))).sort((a, b) => a - b)
  let minGap = Infinity
  for (let i = 1; i < cols.length; i++) minGap = Math.min(minGap, cols[i] - cols[i - 1])
  if (!isFinite(minGap) || minGap <= 0) minGap = 1

  const firstCol = cols[0]
  const colToStep = (c: number) => Math.round((c - firstCol) / minGap)

  const byCol = new Map<number, RawNote[]>()
  for (const r of raw) {
    if (!byCol.has(r.col)) byCol.set(r.col, [])
    byCol.get(r.col)!.push(r)
  }

  const steps = cols.map(colToStep)
  const events: MelodyEvent[] = []
  let maxEnd = 0
  cols.forEach((c, idx) => {
    const step = steps[idx]
    const nextStep = idx + 1 < steps.length ? steps[idx + 1] : step + 1
    const start = step * baseBeats
    const duration = Math.max(baseBeats, (nextStep - step) * baseBeats)
    maxEnd = Math.max(maxEnd, start + duration)
    for (const r of byCol.get(c)!) {
      events.push({ pitch: pitchAt(tuning, capo, r.string, r.fret), start, duration })
    }
  })

  // Round the system length up to a whole measure so the next system starts on a bar.
  const totalBeats = Math.max(beatsPerMeasure, Math.ceil(maxEnd / beatsPerMeasure - 1e-6) * beatsPerMeasure)
  return { events, totalBeats }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const SUBDIV = 4 // 16th-note grid
const CELL = 2 // characters per grid cell (fits a 2-digit fret)

/** Lay a bare melody onto the fretboard (high strings) and render it as a tab. */
export function melodyToTab(melody: Melody, tuning: Tuning, capo: number): string {
  let handFret = 0
  const notes: TabNote[] = []
  for (const e of melody.events) {
    const pos = choosePosition(tuning, capo, e.pitch, {
      handFret,
      preferHighStrings: true,
      maxString: 3,
      maxFret: 12,
    })
    if (!pos) continue
    if (pos.fret > 0) handFret = pos.fret
    notes.push({ pitch: e.pitch, string: pos.string, fret: pos.fret, start: e.start, duration: e.duration, voice: 'melody' })
  }
  return renderTab(notes, melody.beatsPerMeasure)
}

/** Render structured notes to a clean copy-pasteable six-string tab. */
export function renderTab(
  notes: TabNote[],
  beatsPerMeasure = 4,
  numStrings = 6,
): string {
  if (notes.length === 0) return STRING_LABELS.map((l) => `${l}|--------|`).join('\n')

  const end = Math.max(...notes.map((n) => n.start + n.duration))
  const totalMeasures = Math.max(1, Math.ceil(end / beatsPerMeasure - 1e-6))
  const cellsPerMeasure = beatsPerMeasure * SUBDIV
  const totalCells = totalMeasures * cellsPerMeasure

  // grid[string] = array of cell strings ('' = empty).
  const grid: string[][] = Array.from({ length: numStrings }, () =>
    new Array(totalCells).fill(''),
  )
  for (const n of notes) {
    if (n.voice === 'percussion') continue
    const cell = Math.round(n.start * SUBDIV)
    if (cell < 0 || cell >= totalCells) continue
    const s = Math.min(numStrings - 1, Math.max(0, n.string))
    // Don't overwrite an existing fret in the same cell (keep the melody on top).
    if (grid[s][cell] === '') grid[s][cell] = String(n.fret)
  }

  const lines: string[] = []
  for (let s = 0; s < numStrings; s++) {
    let line = `${STRING_LABELS[s] ?? '?'}|`
    for (let m = 0; m < totalMeasures; m++) {
      for (let c = 0; c < cellsPerMeasure; c++) {
        const cell = m * cellsPerMeasure + c
        const val = grid[s][cell]
        line += (val === '' ? '-' : val).padEnd(CELL, '-')
      }
      line += '|'
    }
    lines.push(line)
  }
  return lines.join('\n')
}
