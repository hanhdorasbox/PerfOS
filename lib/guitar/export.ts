// ─── Exporters: MIDI (Standard MIDI File) & MusicXML ─────────────────────────
//
// Pure functions producing bytes / strings so they work identically on the
// server and in the browser (download is wired up in the UI). Rhythm, tempo,
// tuning and pitches are preserved.

import type { Arrangement, TabNote } from './types'
import { noteName, pitchClass } from './theory'

const PPQ = 480

// ── MIDI ──────────────────────────────────────────────────────────────────────

function vlq(value: number): number[] {
  // Variable-length quantity encoding used by SMF delta times.
  let buffer = value & 0x7f
  const bytes: number[] = []
  while ((value >>= 7)) {
    buffer <<= 8
    buffer |= (value & 0x7f) | 0x80
  }
  while (true) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

function str(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0))
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

interface MidiEvt {
  tick: number
  on: boolean
  pitch: number
  vel: number
  channel: number
}

/** Encode an arrangement as a Standard MIDI File (format 0). */
export function toMidi(arr: Arrangement): Uint8Array {
  const events: MidiEvt[] = []
  for (const n of arr.notes) {
    const tick = Math.round(n.start * PPQ)
    const dur = Math.max(1, Math.round(n.duration * PPQ))
    if (n.voice === 'percussion') {
      // Channel 10 (index 9), side-stick-ish.
      events.push({ tick, on: true, pitch: 37, vel: 90, channel: 9 })
      events.push({ tick: tick + dur, on: false, pitch: 37, vel: 0, channel: 9 })
      continue
    }
    if (n.pitch <= 0) continue
    const vel = Math.round(60 + (n.velocity ?? 0.8) * 55)
    events.push({ tick, on: true, pitch: n.pitch, vel, channel: 0 })
    events.push({ tick: tick + dur, on: false, pitch: n.pitch, vel: 0, channel: 0 })
  }
  // note-offs before note-ons at the same tick
  events.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on))

  const track: number[] = []
  // Tempo meta
  const usPerQuarter = Math.round(60000000 / arr.tempo)
  track.push(...vlq(0), 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff)
  // Program change: steel-string acoustic guitar (25) on channel 0
  track.push(...vlq(0), 0xc0, 25)

  let last = 0
  for (const e of events) {
    const delta = e.tick - last
    last = e.tick
    track.push(...vlq(delta))
    track.push((e.on ? 0x90 : 0x80) | (e.channel & 0x0f), e.pitch & 0x7f, e.vel & 0x7f)
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00) // end of track

  const header = [...str('MThd'), ...u32(6), 0x00, 0x00, 0x00, 0x01, (PPQ >> 8) & 0xff, PPQ & 0xff]
  const trackChunk = [...str('MTrk'), ...u32(track.length), ...track]
  return new Uint8Array([...header, ...trackChunk])
}

// ── MusicXML ────────────────────────────────────────────────────────────────
//
// A block-chord reduction: within each measure the notes are tiled by their
// onsets (no overlaps), which imports cleanly into notation software while
// preserving every pitch, the tab positions, tempo and key.

const DIVISIONS = 4 // per quarter note (16th resolution)

function xmlDuration(beats: number): number {
  return Math.max(1, Math.round(beats * DIVISIONS))
}

function typeForDivisions(div: number): string {
  const q = div / DIVISIONS
  if (q >= 4) return 'whole'
  if (q >= 2) return 'half'
  if (q >= 1) return 'quarter'
  if (q >= 0.5) return 'eighth'
  return '16th'
}

function noteXml(n: TabNote, isChord: boolean, div: number, stringCount: number): string {
  if (n.pitch <= 0) return ''
  const step = noteName(n.pitch).replace(/[0-9-]/g, '')
  const letter = step[0]
  const alter = step.includes('#') ? 1 : 0
  const octave = Math.floor(n.pitch / 12) - 1
  const guitarString = stringCount - n.string // MusicXML strings: 1 = highest-pitched? uses 1=high E as string 1
  return [
    '      <note>',
    isChord ? '        <chord/>' : '',
    '        <pitch>',
    `          <step>${letter}</step>`,
    alter ? `          <alter>${alter}</alter>` : '',
    `          <octave>${octave}</octave>`,
    '        </pitch>',
    `        <duration>${div}</duration>`,
    `        <type>${typeForDivisions(div)}</type>`,
    '        <notations>',
    '          <technical>',
    `            <string>${Math.max(1, guitarString)}</string>`,
    `            <fret>${n.fret}</fret>`,
    '          </technical>',
    '        </notations>',
    '      </note>',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Encode an arrangement as MusicXML (partwise). */
export function toMusicXml(arr: Arrangement): string {
  const bpm = arr.beatsPerMeasure
  const fifthsMap: Record<number, number> = {
    0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5, 6: 6,
  }
  const fifths = fifthsMap[pitchClass(arr.key.tonic)] ?? 0
  const stringCount = arr.tuning.strings.length

  const measuresXml = arr.measures
    .map((measure, mi) => {
      const notes = measure.notes.filter((n) => n.voice !== 'percussion' && n.pitch > 0)
      // Group by onset within the measure.
      const onsets = Array.from(new Set(notes.map((n) => +(n.start).toFixed(4)))).sort((a, b) => a - b)
      const mStart = mi * bpm
      let cursor = mStart
      const body: string[] = []

      onsets.forEach((onset, oi) => {
        // Rest for any gap before this onset.
        if (onset - cursor > 1e-6) {
          const restDiv = xmlDuration(onset - cursor)
          body.push(
            `      <note>\n        <rest/>\n        <duration>${restDiv}</duration>\n        <type>${typeForDivisions(restDiv)}</type>\n      </note>`,
          )
        }
        const nextOnset = oi + 1 < onsets.length ? onsets[oi + 1] : mStart + bpm
        const div = xmlDuration(nextOnset - onset)
        const group = notes.filter((n) => Math.abs(n.start - onset) < 1e-6).sort((a, b) => a.pitch - b.pitch)
        group.forEach((n, gi) => {
          const x = noteXml(n, gi > 0, div, stringCount)
          if (x) body.push(x)
        })
        cursor = nextOnset
      })
      // Trailing rest to complete the measure.
      const measureEnd = mStart + bpm
      if (measureEnd - cursor > 1e-6) {
        const restDiv = xmlDuration(measureEnd - cursor)
        body.push(
          `      <note>\n        <rest/>\n        <duration>${restDiv}</duration>\n        <type>${typeForDivisions(restDiv)}</type>\n      </note>`,
        )
      }

      const attributes =
        mi === 0
          ? [
              '      <attributes>',
              `        <divisions>${DIVISIONS}</divisions>`,
              `        <key><fifths>${fifths}</fifths><mode>${arr.key.mode}</mode></key>`,
              `        <time><beats>${bpm}</beats><beat-type>4</beat-type></time>`,
              '        <clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>',
              '      </attributes>',
              `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${arr.tempo}</per-minute></metronome></direction-type><sound tempo="${arr.tempo}"/></direction>`,
            ].join('\n')
          : ''

      const harmony = measure.chord
        ? `      <harmony><root><root-step>${noteName(measure.chord.root + 60).replace(/[0-9]/g, '').replace('#', '')}</root-step>${measure.chord.symbol.includes('#') ? '<root-alter>1</root-alter>' : ''}</root><kind text="${measure.chord.symbol}">${musicXmlKind(measure.chord.quality)}</kind></harmony>`
        : ''

      return `    <measure number="${mi + 1}">\n${[attributes, harmony, ...body].filter(Boolean).join('\n')}\n    </measure>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Acoustic Arrangement — ${arr.label}</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Acoustic Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`
}

function musicXmlKind(quality: string): string {
  const map: Record<string, string> = {
    maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented',
    '7': 'dominant', maj7: 'major-seventh', min7: 'minor-seventh',
    m7b5: 'half-diminished', sus2: 'suspended-second', sus4: 'suspended-fourth',
    '6': 'major-sixth', add9: 'major',
  }
  return map[quality] ?? 'major'
}
