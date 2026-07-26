'use client'

import type { ReactNode } from 'react'
import type { MuscleId, ActivationMap, Activation } from '@/lib/fitness/bodyMap'

// Stylised front/back body map. Muscles fill with the "worked" colour by
// activation level (primary = strong, secondary = light); the figure is built
// from simple blocks so it reads clearly rather than being anatomically exact.

const C = {
  primary: '#ff8168',
  secondary: 'rgba(255, 129, 104, 0.42)',
  base: '#33333c',
  stroke: 'rgba(255,255,255,0.10)',
  skin: '#2a2a31',
}

const fillFor = (a?: Activation) => (a === 'primary' ? C.primary : a === 'secondary' ? C.secondary : C.base)

function M({ id, act, children }: { id: MuscleId; act: ActivationMap; children: ReactNode }) {
  return (
    <g fill={fillFor(act[id])} stroke={C.stroke} strokeWidth={0.6} style={{ transition: 'fill 0.2s ease' }}>
      {children}
    </g>
  )
}

function FrontFigure({ act }: { act: ActivationMap }) {
  return (
    <svg viewBox="0 0 100 240" width="100%" height="100%" role="img" aria-label="Front muscles">
      {/* base body — head, neck, shins */}
      <g fill={C.skin} stroke={C.stroke} strokeWidth={0.6}>
        <circle cx={50} cy={14} r={10} />
        <rect x={44} y={22} width={12} height={7} rx={3} />
        <rect x={35} y={158} width={11} height={44} rx={5} />
        <rect x={54} y={158} width={11} height={44} rx={5} />
        <ellipse cx={40.5} cy={206} rx={6} ry={4} />
        <ellipse cx={59.5} cy={206} rx={6} ry={4} />
      </g>
      <M id="traps" act={act}>
        <polygon points="45,27 31,39 45,33" />
        <polygon points="55,27 69,39 55,33" />
      </M>
      <M id="sideDelts" act={act}>
        <ellipse cx={21} cy={46} rx={6} ry={9} />
        <ellipse cx={79} cy={46} rx={6} ry={9} />
      </M>
      <M id="frontDelts" act={act}>
        <ellipse cx={29} cy={42} rx={9} ry={8} />
        <ellipse cx={71} cy={42} rx={9} ry={8} />
      </M>
      <M id="chest" act={act}>
        <path d="M49 41 L49 57 Q40 60 33 53 Q31 44 40 41 Z" />
        <path d="M51 41 L51 57 Q60 60 67 53 Q69 44 60 41 Z" />
      </M>
      <M id="biceps" act={act}>
        <ellipse cx={22} cy={65} rx={6} ry={12} />
        <ellipse cx={78} cy={65} rx={6} ry={12} />
      </M>
      <M id="forearms" act={act}>
        <ellipse cx={16} cy={90} rx={5.5} ry={13} />
        <ellipse cx={84} cy={90} rx={5.5} ry={13} />
      </M>
      <M id="obliques" act={act}>
        <ellipse cx={38} cy={80} rx={4} ry={13} />
        <ellipse cx={62} cy={80} rx={4} ry={13} />
      </M>
      <M id="abs" act={act}>
        <rect x={42} y={60} width={16} height={34} rx={5} />
      </M>
      <M id="quads" act={act}>
        <ellipse cx={41} cy={128} rx={10} ry={25} />
        <ellipse cx={59} cy={128} rx={10} ry={25} />
      </M>
    </svg>
  )
}

function BackFigure({ act }: { act: ActivationMap }) {
  return (
    <svg viewBox="0 0 100 240" width="100%" height="100%" role="img" aria-label="Back muscles">
      <g fill={C.skin} stroke={C.stroke} strokeWidth={0.6}>
        <circle cx={50} cy={14} r={10} />
        <rect x={44} y={22} width={12} height={7} rx={3} />
      </g>
      <M id="traps" act={act}>
        <polygon points="50,27 33,35 44,54 50,48 56,54 67,35" />
      </M>
      <M id="rearDelts" act={act}>
        <ellipse cx={28} cy={45} rx={8} ry={7} />
        <ellipse cx={72} cy={45} rx={8} ry={7} />
      </M>
      <M id="upperBack" act={act}>
        <rect x={41} y={50} width={18} height={16} rx={4} />
      </M>
      <M id="lats" act={act}>
        <path d="M40 56 L44 66 L42 86 L33 74 Q32 62 40 56 Z" />
        <path d="M60 56 L56 66 L58 86 L67 74 Q68 62 60 56 Z" />
      </M>
      <M id="triceps" act={act}>
        <ellipse cx={22} cy={65} rx={6} ry={12} />
        <ellipse cx={78} cy={65} rx={6} ry={12} />
      </M>
      <M id="forearms" act={act}>
        <ellipse cx={16} cy={90} rx={5.5} ry={13} />
        <ellipse cx={84} cy={90} rx={5.5} ry={13} />
      </M>
      <M id="lowerBack" act={act}>
        <rect x={43} y={86} width={14} height={16} rx={4} />
      </M>
      <M id="glutes" act={act}>
        <ellipse cx={41} cy={114} rx={10} ry={10} />
        <ellipse cx={59} cy={114} rx={10} ry={10} />
      </M>
      <M id="hamstrings" act={act}>
        <ellipse cx={41} cy={142} rx={9} ry={21} />
        <ellipse cx={59} cy={142} rx={9} ry={21} />
      </M>
      <M id="calves" act={act}>
        <ellipse cx={41} cy={180} rx={7} ry={16} />
        <ellipse cx={59} cy={180} rx={7} ry={16} />
      </M>
    </svg>
  )
}

export default function MuscleMap({ activation }: { activation: ActivationMap }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 150 }}>
          <div style={{ height: 260 }}>
            <FrontFigure act={activation} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Front</div>
        </div>
        <div style={{ flex: 1, maxWidth: 150 }}>
          <div style={{ height: 260 }}>
            <BackFigure act={activation} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Back</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9E9EA6' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: C.primary }} /> Primary
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9E9EA6' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: C.secondary }} /> Secondary
        </span>
      </div>
    </div>
  )
}
