import type { Metadata } from 'next'
import GuitarArranger from '@/components/guitar/GuitarArranger'

export const metadata: Metadata = {
  title: 'Acoustic Arranger — Project Hanh',
  description: 'Turn a simple melody into a full, playable acoustic guitar arrangement.',
}

// Fully client-side feature — no database dependency, so it renders instantly.
export default function GuitarPage() {
  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#F5F5F7', letterSpacing: '-0.02em' }}>
          🎸 Acoustic Arranger
        </h1>
        <p style={{ color: '#9E9EA6', fontSize: 14, marginTop: 6, maxWidth: 680 }}>
          Like having an experienced fingerstyle guitarist beside you. Paste a plain single-note
          melody and it adds bass, chords, rhythm and acoustic techniques around it — preserving
          your melody, keeping everything physically playable, and letting you hear it instantly.
        </p>
      </div>
      <GuitarArranger />
    </div>
  )
}
