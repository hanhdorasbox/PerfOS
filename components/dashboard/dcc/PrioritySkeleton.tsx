'use client'
import Skel from './Skel'


export default function PrioritySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skel w={`${55 + i * 12}%`} h={13} />
            <Skel w="40%" h={10} />
          </div>
        </div>
      ))}
    </div>
  )
}
