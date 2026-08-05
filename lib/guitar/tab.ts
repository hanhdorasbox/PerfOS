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
import { pitchAt } from './fretboard'

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] // index 0 = highest

interface RawNote {
  string: number
  col: number
  fret: number
}

/** Pull the six tab lines out of arbitrary pasted text. */
function extractStringLines(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  // A tab line looks like it contains dashes and/or a leading "X|" label.
  const tabLike = lines.filter((l) => /[-]/.test(l) && /^\s*[a-gA-G#]?\s*\|?[-\d|hpb/\\~*x().\s]+$/.test(l))
  // Prefer the last run of up to 6 consecutive tab-like lines.
  if (tabLike.length >= 1) return tabLike.slice(-6)
  return []
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

  const rows = extractStringLines(text)
  if (rows.length === 0) return { events: [], beatsPerMeasure }

  // Top-most tab line is the highest string (index 0). If fewer than 6 rows are
  // present, align them to the top strings.
  const content = rows.map((r) => stripLabel(r).replace(/\|/g, '-'))

  const raw: RawNote[] = []
  content.forEach((line, stringIdx) => {
    let i = 0
    while (i < line.length) {
      const ch = line[i]
      if (ch >= '0' && ch <= '9') {
        let j = i
        while (j < line.length && line[j] >= '0' && line[j] <= '9') j++
        const fret = parseInt(line.slice(i, j), 10)
        raw.push({ string: stringIdx, col: i, fret })
        i = j
      } else {
        i++
      }
    }
  })

  if (raw.length === 0) return { events: [], beatsPerMeasure }

  // Determine the timing grid from horizontal spacing between note columns.
  const cols = Array.from(new Set(raw.map((r) => r.col))).sort((a, b) => a - b)
  let minGap = Infinity
  for (let i = 1; i < cols.length; i++) minGap = Math.min(minGap, cols[i] - cols[i - 1])
  if (!isFinite(minGap) || minGap <= 0) minGap = 1

  const firstCol = cols[0]
  const colToStep = (c: number) => Math.round((c - firstCol) / minGap)

  // Group notes by column (simultaneous notes = a chord/dyad).
  const byCol = new Map<number, RawNote[]>()
  for (const r of raw) {
    if (!byCol.has(r.col)) byCol.set(r.col, [])
    byCol.get(r.col)!.push(r)
  }

  const steps = cols.map(colToStep)
  const events: MelodyEvent[] = []
  cols.forEach((c, idx) => {
    const step = steps[idx]
    const nextStep = idx + 1 < steps.length ? steps[idx + 1] : step + 1
    const start = step * baseBeats
    const duration = Math.max(baseBeats, (nextStep - step) * baseBeats)
    for (const r of byCol.get(c)!) {
      events.push({ pitch: pitchAt(tuning, capo, r.string, r.fret), start, duration })
    }
  })

  events.sort((a, b) => a.start - b.start || b.pitch - a.pitch)
  return { events, beatsPerMeasure }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const SUBDIV = 4 // 16th-note grid
const CELL = 2 // characters per grid cell (fits a 2-digit fret)

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
