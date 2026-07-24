'use client'


export default function BulletDirective({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const framing: string[] = []
  const bullets: string[] = []
  let seenBullet = false

  for (const line of lines) {
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      seenBullet = true
      bullets.push(line.replace(/^[•\-\*]\s+/, ''))
    } else if (!seenBullet) {
      framing.push(line)
    } else {
      bullets.push(line)
    }
  }

  // No bullets case
  if (bullets.length === 0 && framing.length > 0) {
    const sentences = text.split(/(?<=\.)\s+/)
    if (sentences.length > 1) {
      const shown = expanded ? sentences : [sentences[0]]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.filter(Boolean).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: '#a085ff', flexShrink: 0, fontSize: 11, marginTop: 2, fontWeight: 800 }}>→</span>
              <span style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.6 }}>{s.trim()}</span>
            </div>
          ))}
          {sentences.length > 1 && (
            <button onClick={onToggle} style={{ alignSelf: 'flex-start', fontSize: 10, color: '#52525A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
              {expanded ? 'Collapse ↑' : 'Show all ↓'}
            </button>
          )}
        </div>
      )
    }
    return <div style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.65 }}>{text}</div>
  }

  // Has framing + bullets
  const framingShown = framing.length > 0 ? framing : []
  const firstBullet = bullets.slice(0, 1)
  const restBullets = bullets.slice(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {framingShown.map((line, i) => (
        <div key={`f${i}`} style={{ fontSize: 13, color: '#EEEEF2', fontWeight: 600, lineHeight: 1.5 }}>
          {line}
        </div>
      ))}
      {/* Always show first bullet */}
      {(framingShown.length === 0 ? firstBullet : (expanded ? bullets : firstBullet)).map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: '#a085ff', flexShrink: 0, fontSize: 13, marginTop: 1, lineHeight: 1, fontWeight: 700 }}>•</span>
          <span style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.6 }}>{b}</span>
        </div>
      ))}
      {/* If framing exists, show rest of bullets only when expanded */}
      {framingShown.length > 0 && expanded && restBullets.map((b, i) => (
        <div key={`rb${i}`} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: '#a085ff', flexShrink: 0, fontSize: 13, marginTop: 1, lineHeight: 1, fontWeight: 700 }}>•</span>
          <span style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.6 }}>{b}</span>
        </div>
      ))}
      {(bullets.length > 1 || (framingShown.length > 0 && bullets.length > 0)) && (
        <button onClick={onToggle} style={{ alignSelf: 'flex-start', fontSize: 10, color: '#52525A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
          {expanded ? 'Collapse ↑' : 'Show all ↓'}
        </button>
      )}
    </div>
  )
}
