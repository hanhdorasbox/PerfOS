'use client'
// A reference player: paste a YouTube link (a song, or someone playing it on
// guitar) and it embeds below so you can listen while you transcribe/edit. This
// does NOT pull audio from YouTube — that would break YouTube's terms — it's a
// side-by-side reference only.

import { useState } from 'react'

/** Pull the 11-char video id out of the common YouTube URL shapes. */
export function youTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*\bv=)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim()
  return null
}

export default function YouTubeRef() {
  const [url, setUrl] = useState('')
  const id = youTubeId(url)
  const invalid = url.trim().length > 0 && !id

  return (
    <div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube link — e.g. a song or a guitar cover to play along with"
        style={{
          width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 9,
          background: 'var(--bg-inset, rgba(255,255,255,0.03))', color: '#EEEEF2',
          border: `1px solid ${invalid ? 'rgba(255,130,99,0.4)' : 'var(--border, rgba(255,255,255,0.1))'}`,
        }}
      />
      {invalid && <p style={{ fontSize: 12, color: '#ff8263', marginTop: 6 }}>That doesn’t look like a YouTube link.</p>}
      {id && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title="YouTube reference"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      )}
      <p style={{ fontSize: 11.5, marginTop: 8, color: '#6E6E76' }}>
        Reference only — listen here while you enter or refine the melody. Automatic transcription
        works from an uploaded/recorded audio clip (the “From audio” tab), not from the YouTube link.
      </p>
    </div>
  )
}
