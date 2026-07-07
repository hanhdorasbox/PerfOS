'use client'
import { useState } from 'react'
import { Globe, Cpu, TrendingUp, Briefcase, Users, Activity, Target, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { INTEL_COLORS } from './helpers'
import type { IntelItem } from './types'

const INTEL_ICON_MAP: Record<string, LucideIcon> = {
  geopolitics:  Globe,
  tech:         Cpu,
  markets:      TrendingUp,
  business:     Briefcase,
  society:      Users,
  science:      Activity,
  fitness:      Activity,
  health:       Activity,
  psychology:   Activity,
  nutrition:    Activity,
  productivity: Target,
  habits:       Activity,
  recovery:     Activity,
}

export default function IntelCard({ item }: { item: IntelItem }) {
  const [open, setOpen] = useState(false)
  const catColor = INTEL_COLORS[item.category?.toLowerCase()] ?? '#6E6E76'
  const IconComp = INTEL_ICON_MAP[item.category?.toLowerCase()] ?? Globe

  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{
        padding: '12px 13px', borderRadius: 16, flex: 1, minWidth: 0,
        background: open ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${catColor}AA`,
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
        transition: 'background 0.15s, transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1)',
        boxShadow: open ? '0 4px 24px rgba(0,0,0,0.25)' : 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconComp size={10} color={catColor} strokeWidth={2} />
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: catColor }}>
            {item.category}
          </span>
        </div>
        <ChevronDown size={10} color="#444" strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 12, color: '#D4D4D8', lineHeight: 1.5, fontWeight: 450 }}>
        {item.headline}
      </div>
      {open && item.why && (
        <div style={{
          fontSize: 11, color: '#7A7A84', lineHeight: 1.6,
          borderTop: `1px solid ${catColor}22`,
          paddingTop: 8, marginTop: 1,
        }}>
          {item.why}
        </div>
      )}
    </div>
  )
}
