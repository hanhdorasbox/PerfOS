// ─── Acoustic guitar synthesis (Web Audio) ────────────────────────────────────
//
// A self-contained Karplus-Strong plucked-string synthesiser — no external
// samples or soundfonts, so it works offline and inside a strict CSP.
//
// The string is synthesised *in JavaScript* into an AudioBuffer and played back
// with an AudioBufferSourceNode. This is deliberate: Web Audio's DelayNode has a
// one-render-quantum (128-sample) minimum delay when it sits inside a feedback
// loop, so a "live" KS delay line mistunes every note above ~344 Hz (most of the
// melody). Generating the samples ourselves gives correct pitch across the whole
// guitar range. A gentle body-resonance filter, a soft limiter and a small room
// reverb add acoustic realism.
//
// Everything is browser-only; guard construction behind `typeof window`.

'use client'

export type SynthVoice = 'melody' | 'bass' | 'harmony' | 'percussion'

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Build a short synthetic impulse response for a warm room reverb. */
function makeImpulse(ctx: AudioContext, seconds = 1.1, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(seconds * rate))
  const buffer = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buffer
}

export class AcousticGuitar {
  private ctx: AudioContext
  private master: GainNode
  private reverb: ConvolverNode
  private reverbGain: GainNode
  private body: BiquadFilterNode
  private limiter: DynamicsCompressorNode
  // Cache one synthesised string per (pitch, voice) so busy passages stay cheap.
  private bufferCache = new Map<string, AudioBuffer>()

  constructor() {
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext
    this.ctx = new Ctor()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9

    // Body resonance — a gentle mid presence like a guitar's soundbox.
    this.body = this.ctx.createBiquadFilter()
    this.body.type = 'peaking'
    this.body.frequency.value = 180
    this.body.Q.value = 0.7
    this.body.gain.value = 3

    // Soft limiter so dense chords + reverb never clip into harsh distortion.
    this.limiter = this.ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -6
    this.limiter.knee.value = 6
    this.limiter.ratio.value = 12
    this.limiter.attack.value = 0.003
    this.limiter.release.value = 0.12

    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = makeImpulse(this.ctx)
    this.reverbGain = this.ctx.createGain()
    this.reverbGain.gain.value = 0.16

    this.body.connect(this.master)
    this.master.connect(this.limiter)
    this.master.connect(this.reverb)
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(this.limiter)
    this.limiter.connect(this.ctx.destination)
  }

  /**
   * Synthesise one plucked-string tone with the Karplus-Strong algorithm and
   * cache it. `damp` (<1) sets how fast the tone decays; `tone` low-passes the
   * excitation for a warmer/darker attack.
   */
  private stringBuffer(freq: number, voice: SynthVoice): AudioBuffer {
    const key = `${Math.round(freq * 10)}:${voice}`
    const cached = this.bufferCache.get(key)
    if (cached) return cached

    const sr = this.ctx.sampleRate
    const N = Math.max(2, Math.round(sr / freq)) // delay-line length = one period
    // Longer, warmer sustain for bass; brighter and shorter for the melody.
    const decay = voice === 'bass' ? 0.9965 : voice === 'harmony' ? 0.994 : 0.9955
    const seconds = voice === 'bass' ? 3.4 : 2.6
    const total = Math.ceil(seconds * sr)
    const buffer = this.ctx.createBuffer(1, total, sr)
    const out = buffer.getChannelData(0)

    // Excitation: white noise, lightly low-passed so the attack isn't fizzy.
    const y = new Float32Array(N)
    let prev = 0
    for (let i = 0; i < N; i++) {
      const white = Math.random() * 2 - 1
      prev = 0.5 * white + 0.5 * prev
      y[i] = prev
    }

    // Karplus-Strong: output the delay line, then write back the averaged
    // (low-passed) and slightly decayed value — higher partials die first.
    let ptr = 0
    for (let n = 0; n < total; n++) {
      const cur = y[ptr]
      out[n] = cur
      const next = y[(ptr + 1) % N]
      y[ptr] = decay * 0.5 * (cur + next)
      ptr = (ptr + 1) % N
    }

    // Normalise so every pitch has a consistent level, then fade the tail.
    let peak = 0
    for (let n = 0; n < total; n++) peak = Math.max(peak, Math.abs(out[n]))
    const norm = peak > 0 ? 0.85 / peak : 1
    const fade = Math.min(total, Math.floor(0.02 * sr))
    for (let n = 0; n < total; n++) {
      let g = norm
      if (n < 64) g *= n / 64 // tiny attack ramp, no click
      if (n > total - fade) g *= (total - n) / fade
      out[n] *= g
    }

    this.bufferCache.set(key, buffer)
    return buffer
  }

  get context(): AudioContext {
    return this.ctx
  }

  /** Wall-clock time in the audio context. */
  now(): number {
    return this.ctx.currentTime
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  setMasterGain(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  setReverb(v: number): void {
    this.reverbGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  /**
   * Pluck a string: play the pre-synthesised Karplus-Strong tone for this pitch,
   * shaped by an attack + note-off release envelope. Correct pitch at every
   * frequency (no feedback-delay minimum), and cheap because the buffer is cached.
   */
  pluck(midi: number, at: number, duration: number, gain = 0.8, voice: SynthVoice = 'melody'): void {
    const ctx = this.ctx
    const t = Math.max(at, ctx.currentTime)
    const freq = midiToFreq(midi)

    const src = ctx.createBufferSource()
    src.buffer = this.stringBuffer(freq, voice)

    const g = ctx.createGain()
    const peak = Math.max(0.05, Math.min(1, gain))
    // Let the note ring, then release gently at its notated end.
    const rel = voice === 'bass' ? 0.28 : 0.18
    g.gain.setValueAtTime(peak, t)
    g.gain.setValueAtTime(peak, t + duration)
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration + rel)

    src.connect(g)
    g.connect(this.body)

    src.start(t)
    const stopAt = t + duration + rel + 0.05
    src.stop(stopAt)
    src.onended = () => {
      try {
        src.disconnect()
        g.disconnect()
      } catch {
        /* already gone */
      }
    }
  }

  /** Percussive body tap / muted slap. */
  perc(at: number, gain = 0.5): void {
    const ctx = this.ctx
    const t = Math.max(at, ctx.currentTime)
    const src = ctx.createBufferSource()
    const len = Math.ceil(0.08 * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 220
    bp.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(bp)
    bp.connect(g)
    g.connect(this.body)
    src.start(t)
    src.stop(t + 0.09)
  }

  /** A soft metronome click. */
  click(at: number, accent = false): void {
    const ctx = this.ctx
    const t = Math.max(at, ctx.currentTime)
    const osc = ctx.createOscillator()
    osc.frequency.value = accent ? 1600 : 1000
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(accent ? 0.28 : 0.16, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.06)
  }

  close(): void {
    this.ctx.close().catch(() => {})
  }
}
