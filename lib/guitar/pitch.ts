// ─── Monophonic pitch detection & melody transcription ────────────────────────
//
// Turns an audio signal (an uploaded file or a mic recording, decoded to a
// Float32Array) into a rhythmic melody the arranger can use. Pure JS/DSP — the
// YIN algorithm (de Cheveigné & Kawahara, 2002) — so it runs offline with no ML
// model and no external dependencies.
//
// It tracks ONE note at a time, so it shines on a clear single-note line — a
// hummed tune, a whistled melody, or a solo instrument. It is not meant to pull a
// lead out of a full band mix.

import type { Melody, MelodyEvent } from './types'

export interface PitchResult {
  f0: number // Hz, 0 when unvoiced
  confidence: number // 0..1
}

/**
 * YIN fundamental-frequency estimate for a single analysis frame.
 * Returns f0 = 0 when no confident pitch is found.
 */
export function yinPitch(
  frame: Float32Array,
  sampleRate: number,
  threshold = 0.12,
  minFreq = 70,
  maxFreq = 1200,
): PitchResult {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq))
  const tauMax = Math.min(Math.floor(frame.length / 2), Math.floor(sampleRate / minFreq))
  if (tauMax <= tauMin) return { f0: 0, confidence: 0 }

  // 1) Difference function.
  const diff = new Float32Array(tauMax)
  for (let tau = tauMin; tau < tauMax; tau++) {
    let sum = 0
    for (let j = 0; j < tauMax; j++) {
      const d = frame[j] - frame[j + tau]
      sum += d * d
    }
    diff[tau] = sum
  }

  // 2) Cumulative mean normalised difference.
  const cmnd = new Float32Array(tauMax)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau < tauMax; tau++) {
    running += diff[tau]
    cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1
  }

  // 3) Absolute threshold — first dip below `threshold`.
  let tau = -1
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  if (tau === -1) {
    // Fall back to the global minimum — lower confidence.
    let best = tauMin
    for (let t = tauMin; t < tauMax; t++) if (cmnd[t] < cmnd[best]) best = t
    tau = best
    if (cmnd[tau] > 0.6) return { f0: 0, confidence: 0 }
  }

  // 4) Parabolic interpolation for sub-sample accuracy.
  let betterTau = tau
  if (tau > tauMin && tau < tauMax - 1) {
    const s0 = cmnd[tau - 1]
    const s1 = cmnd[tau]
    const s2 = cmnd[tau + 1]
    const denom = 2 * (2 * s1 - s2 - s0)
    if (denom !== 0) betterTau = tau + (s2 - s0) / denom
  }

  return { f0: sampleRate / betterTau, confidence: 1 - cmnd[tau] }
}

function freqToMidi(f: number): number {
  return Math.round(69 + 12 * Math.log2(f / 440))
}

function rms(frame: Float32Array): number {
  let s = 0
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i]
  return Math.sqrt(s / frame.length)
}

/** Median of a numeric window (for smoothing octave jumps). */
function median(vals: number[]): number {
  const a = [...vals].sort((x, y) => x - y)
  return a[Math.floor(a.length / 2)]
}

export interface TranscribeOptions {
  tempo: number // BPM — used to express note timing in beats
  beatsPerMeasure?: number
  frameSize?: number
  hop?: number
  /** Quantise note starts/lengths to this grid in beats (0.25 = sixteenth). */
  grid?: number
  /** Notes shorter than this (seconds) are treated as noise. */
  minNoteSec?: number
  /** Relative loudness gate (0..1 of peak RMS) below which frames are unvoiced. */
  silenceGate?: number
}

/**
 * Transcribe a mono audio signal into a rhythmic melody.
 * Timing is quantised to a grid so the result is musically usable.
 */
export function transcribe(
  samples: Float32Array,
  sampleRate: number,
  opts: TranscribeOptions,
): Melody {
  const beatsPerMeasure = opts.beatsPerMeasure ?? 4
  const frameSize = opts.frameSize ?? 2048
  const hop = opts.hop ?? 512
  const grid = opts.grid ?? 0.25
  const minNoteSec = opts.minNoteSec ?? 0.09
  const bps = opts.tempo / 60 // beats per second

  // 1) Per-frame pitch + energy.
  const midiSeq: number[] = []
  const rmsSeq: number[] = []
  let peakRms = 1e-9
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    const frame = samples.subarray(start, start + frameSize)
    const energy = rms(frame)
    peakRms = Math.max(peakRms, energy)
    rmsSeq.push(energy)
    const { f0, confidence } = yinPitch(frame, sampleRate)
    midiSeq.push(f0 > 0 && confidence > 0.85 ? freqToMidi(f0) : 0)
  }

  const gate = (opts.silenceGate ?? 0.08) * peakRms

  // 2) Median-smooth pitches (kills isolated octave errors) and apply the gate.
  const smooth: number[] = midiSeq.map((m, i) => {
    if (rmsSeq[i] < gate) return 0
    const win: number[] = []
    for (let k = -2; k <= 2; k++) {
      const v = midiSeq[i + k]
      if (v && v > 0) win.push(v)
    }
    return win.length ? median(win) : 0
  })

  // 3) Segment consecutive equal pitches into notes.
  const secPerHop = hop / sampleRate
  const events: MelodyEvent[] = []
  let runPitch = 0
  let runStart = 0
  const flush = (endIdx: number) => {
    if (runPitch > 0) {
      const startSec = runStart * secPerHop
      const durSec = (endIdx - runStart) * secPerHop
      if (durSec >= minNoteSec) {
        const startBeat = quantise(startSec * bps, grid)
        let durBeat = quantise(durSec * bps, grid)
        if (durBeat < grid) durBeat = grid
        events.push({ pitch: runPitch, start: startBeat, duration: durBeat })
      }
    }
  }
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] !== runPitch) {
      flush(i)
      runPitch = smooth[i]
      runStart = i
    }
  }
  flush(smooth.length)

  // 4) Merge immediately-adjacent identical pitches created by quantisation and
  //    drop zero-length overlaps; keep a clean monophonic timeline.
  const cleaned: MelodyEvent[] = []
  for (const e of events) {
    const prev = cleaned[cleaned.length - 1]
    if (prev && prev.pitch === e.pitch && Math.abs(prev.start + prev.duration - e.start) < 1e-6) {
      prev.duration += e.duration
    } else if (prev && e.start < prev.start + prev.duration) {
      // trim overlap
      const s = prev.start + prev.duration
      if (e.start + e.duration > s) cleaned.push({ ...e, start: s, duration: e.start + e.duration - s })
    } else {
      cleaned.push({ ...e })
    }
  }

  return { events: cleaned, beatsPerMeasure }
}

function quantise(v: number, grid: number): number {
  return Math.round(v / grid) * grid
}
