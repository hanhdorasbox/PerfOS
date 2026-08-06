'use client'
// Transcribe a screenshot of a tab (or simple notation) into a melody TAB via
// Claude vision (server route /api/guitar/transcribe-image). Best on a clear
// ASCII tab image. Upload a file or paste a screenshot with Ctrl/Cmd+V.

import { useRef, useState } from 'react'
import { notesStringToMelody, melodyToTab, TUNINGS } from '@/lib/guitar'
import type { TuningName } from '@/lib/guitar/types'

type Status = 'idle' | 'reading' | 'done' | 'error'

/** Split a data URL into base64 payload + media type. */
function splitDataUrl(dataUrl: string): { data: string; mediaType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!m) return { data: '', mediaType: 'image/png' }
  return { mediaType: m[1], data: m[2] }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read the file'))
    r.readAsDataURL(file)
  })
}

export default function ImageImport({
  tuning,
  capo,
  onMelody,
}: {
  tuning: TuningName
  capo: number
  onMelody: (info: { tab: string; tempo: number; beatsPerMeasure: number; title: string | null }) => void
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setStatus('error')
      setMessage('That’s not an image.')
      return
    }
    setStatus('reading')
    setMessage('Reading the tab with Claude…')
    try {
      const dataUrl = await readAsDataUrl(file)
      setPreview(dataUrl)
      const { data, mediaType } = splitDataUrl(dataUrl)
      const res = await fetch('/api/guitar/transcribe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(json.error || 'Transcription failed.')
        return
      }
      const melody = notesStringToMelody(json.notes, json.beatsPerMeasure)
      if (melody.events.length === 0) {
        setStatus('error')
        setMessage('No readable melody in that image. Try a sharper, cropped tab.')
        return
      }
      const tab = melodyToTab(melody, TUNINGS[tuning], capo)
      onMelody({ tab, tempo: json.tempo, beatsPerMeasure: json.beatsPerMeasure, title: json.title })
      setStatus('done')
      setMessage(`Read ${melody.events.length} notes${json.title ? ` (“${json.title}”)` : ''} → loaded into the tab.`)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) {
      e.preventDefault()
      void handleImage(file)
    }
  }

  return (
    <div
      onPaste={onPaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) void handleImage(file)
      }}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} disabled={status === 'reading'} style={btn}>
          🖼 Upload tab screenshot
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: 12, color: '#6E6E76' }}>…or paste a screenshot (Ctrl/⌘+V) or drag one here</span>
        {status === 'reading' && <span style={{ fontSize: 12, color: '#64f0aa' }}>⏳ reading…</span>}
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local data-URL preview; next/image adds nothing here
        <img
          src={preview}
          alt="tab preview"
          style={{ marginTop: 10, maxHeight: 140, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))' }}
        />
      )}

      {message && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: status === 'error' ? '#ff8263' : status === 'done' ? '#64f0aa' : '#9E9EA6' }}>
          {message}
        </p>
      )}
      <p style={{ fontSize: 11.5, marginTop: 8, color: '#6E6E76' }}>
        Reads the main melody from a tab image (best with a clear ASCII tab — e.g. a Songsterr /
        Ultimate Guitar screenshot). It extracts the lead line; you can tweak the tab afterwards.
      </p>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, fontSize: 13, cursor: 'pointer',
  border: '1px solid var(--border, rgba(255,255,255,0.12))', background: 'rgba(255,255,255,0.04)', color: '#EEEEF2',
}
