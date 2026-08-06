'use client'
// Transcribe an uploaded audio file or a mic recording into a melody TAB.
// Uses the offline YIN pitch tracker (lib/guitar/pitch). Monophonic — best on a
// clear single-note line (hum it, whistle, or a solo instrument).

import { useRef, useState } from 'react'
import { transcribe, melodyToTab, TUNINGS } from '@/lib/guitar'
import type { TuningName } from '@/lib/guitar/types'

type Status = 'idle' | 'recording' | 'processing' | 'done' | 'error'

const MAX_SECONDS = 20
const TARGET_SR = 22050

/** Average multi-channel audio down to a single mono Float32Array. */
function toMono(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels
  if (ch === 1) return buffer.getChannelData(0).slice()
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) out[i] += data[i] / ch
  }
  return out
}

/** Cheap integer-factor downsample (block average) to lighten YIN's workload. */
function downsample(samples: Float32Array, srcRate: number): { data: Float32Array; rate: number } {
  const factor = Math.max(1, Math.round(srcRate / TARGET_SR))
  if (factor === 1) return { data: samples, rate: srcRate }
  const outLen = Math.floor(samples.length / factor)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    let s = 0
    for (let k = 0; k < factor; k++) s += samples[i * factor + k]
    out[i] = s / factor
  }
  return { data: out, rate: srcRate / factor }
}

export default function AudioImport({
  tempo,
  tuning,
  capo,
  beatsPerMeasure,
  onMelody,
}: {
  tempo: number
  tuning: TuningName
  capo: number
  beatsPerMeasure: number
  onMelody: (tab: string, noteCount: number) => void
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processBlobOrBuffer(arrayBuffer: ArrayBuffer) {
    setStatus('processing')
    setMessage('Analysing pitch…')
    // Let the UI paint the spinner before the (synchronous) DSP work.
    await new Promise((r) => setTimeout(r, 30))
    try {
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
        window.AudioContext
      const ctx = new Ctor()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      ctx.close()

      let mono = toMono(decoded)
      const { data, rate } = downsample(mono, decoded.sampleRate)
      mono = data
      const capped = mono.length > MAX_SECONDS * rate ? mono.subarray(0, MAX_SECONDS * rate) : mono

      const melody = transcribe(capped, rate, { tempo, beatsPerMeasure })
      if (melody.events.length === 0) {
        setStatus('error')
        setMessage('No clear melody detected. Try a louder, single-note line (hum it), closer to the mic.')
        return
      }
      const tab = melodyToTab(melody, TUNINGS[tuning], capo)
      onMelody(tab, melody.events.length)
      setStatus('done')
      setMessage(`Detected ${melody.events.length} notes → loaded into the tab. Tweak if needed, then Generate.`)
    } catch (e) {
      setStatus('error')
      setMessage('Could not read that audio. ' + (e instanceof Error ? e.message : ''))
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(`Reading ${file.name}…`)
    const buf = await file.arrayBuffer()
    await processBlobOrBuffer(buf)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: rec.mimeType })
        await processBlobOrBuffer(await blob.arrayBuffer())
      }
      recRef.current = rec
      rec.start()
      setStatus('recording')
      setElapsed(0)
      setMessage('Recording… play or hum the melody, then Stop.')
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_SECONDS) stopRecording()
          return s + 1
        })
      }, 1000)
    } catch {
      setStatus('error')
      setMessage('Microphone not available or permission denied.')
    }
  }

  function stopRecording() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }

  const busy = status === 'processing'
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn}>
          ⬆ Upload audio file
        </button>
        <input ref={fileRef} type="file" accept="audio/*" onChange={onFile} style={{ display: 'none' }} />
        {status === 'recording' ? (
          <button onClick={stopRecording} style={{ ...btn, borderColor: 'rgba(255,86,123,0.5)', color: '#ff567b', background: 'rgba(255,86,123,0.08)' }}>
            ■ Stop ({MAX_SECONDS - elapsed}s)
          </button>
        ) : (
          <button onClick={startRecording} disabled={busy} style={btn}>🎙 Record from mic</button>
        )}
        {busy && <span style={{ fontSize: 12, color: '#64f0aa' }}>⏳ analysing…</span>}
      </div>
      {message && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: status === 'error' ? '#ff8263' : status === 'done' ? '#64f0aa' : '#9E9EA6' }}>
          {message}
        </p>
      )}
      <p style={{ fontSize: 11.5, marginTop: 8, color: '#6E6E76' }}>
        Tip: works best on one clear note at a time — hum or play the melody solo. It’s not made to
        pull a lead out of a full band mix. Max {MAX_SECONDS}s. Timing uses the tempo set above.
      </p>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, fontSize: 13, cursor: 'pointer',
  border: '1px solid var(--border, rgba(255,255,255,0.12))', background: 'rgba(255,255,255,0.04)', color: '#EEEEF2',
}
