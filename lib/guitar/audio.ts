// ─── Acoustic guitar synthesis (Web Audio) ────────────────────────────────────
//
// A self-contained Karplus-Strong plucked-string synthesiser — no external
// samples or soundfonts, so it works offline and inside a strict CSP. Each note
// excites a short noise burst into a tuned feedback delay line, which naturally
// produces the warm, resonant decay of a steel-string acoustic. A gentle body
// resonance filter and a small room reverb add acoustic realism.
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

    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = makeImpulse(this.ctx)
    this.reverbGain = this.ctx.createGain()
    this.reverbGain.gain.value = 0.18

    this.body.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.master.connect(this.reverb)
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(this.ctx.destination)
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
   * Pluck a string. Karplus-Strong: a noise burst enters a delay line tuned to
   * the pitch period, fed back through a damping low-pass so higher partials die
   * away first — exactly how a real string decays.
   */
  pluck(midi: number, at: number, duration: number, gain = 0.8, voice: SynthVoice = 'melody'): void {
    const ctx = this.ctx
    const t = Math.max(at, ctx.currentTime)
    const freq = midiToFreq(midi)

    // Excitation: a short filtered noise burst = the pick attack.
    const burstLen = 0.02
    const burst = ctx.createBufferSource()
    const buf = ctx.createBuffer(1, Math.ceil(burstLen * ctx.sampleRate), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    burst.buffer = buf

    const burstGain = ctx.createGain()
    burstGain.gain.value = gain

    // Delay line tuned to the pitch period → the string.
    const delay = ctx.createDelay(0.05)
    delay.delayTime.value = 1 / freq

    const feedback = ctx.createGain()
    // Longer sustain for bass, brighter/shorter for melody.
    const decayFactor = voice === 'bass' ? 0.99 : voice === 'harmony' ? 0.982 : 0.986
    feedback.gain.value = decayFactor

    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = voice === 'bass' ? 2600 : 4200
    damp.Q.value = 0.2

    // KS loop: delay → damping → feedback → back into delay.
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)

    burst.connect(burstGain)
    burstGain.connect(delay)

    // Output envelope so notes release cleanly at their duration.
    const out = ctx.createGain()
    out.gain.setValueAtTime(1, t)
    const rel = Math.min(0.35, Math.max(0.12, duration))
    out.gain.setValueAtTime(1, t + duration * 0.6)
    out.gain.exponentialRampToValueAtTime(0.0008, t + duration * 0.6 + rel)

    delay.connect(out)
    out.connect(this.body)

    burst.start(t)
    burst.stop(t + burstLen)
    // Stop the ringing eventually so nodes get GC'd.
    const stopAt = t + duration * 0.6 + rel + 0.1
    feedback.gain.setValueAtTime(decayFactor, t)
    feedback.gain.setTargetAtTime(0, t + duration * 0.6, 0.08)
    setTimeout(() => {
      try {
        out.disconnect()
        delay.disconnect()
        damp.disconnect()
        feedback.disconnect()
        burstGain.disconnect()
      } catch {
        /* already gone */
      }
    }, (stopAt - ctx.currentTime + 0.2) * 1000)
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
