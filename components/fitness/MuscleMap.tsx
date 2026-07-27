'use client'

import type { MuscleId, ActivationMap, Activation } from '@/lib/fitness/bodyMap'

// Anatomical front/back body map. A continuous human silhouette (head, neck,
// torso, arms, legs, hands, feet) is drawn in the base colour, with each muscle
// group overlaid as an organically-shaped region that fills with the "worked"
// colour by activation level (primary = strong, secondary = light).

const C = {
  primary: '#ff8168',
  secondary: 'rgba(255, 129, 104, 0.42)',
  base: '#33333c',
  stroke: 'rgba(255,255,255,0.10)',
  skin: '#26262c',
}

const fillFor = (a?: Activation) => (a === 'primary' ? C.primary : a === 'secondary' ? C.secondary : C.base)

// Shared human silhouette (identical for front and back).
const BODY: string[] = [
  // torso: shoulders → waist → pelvis
  'M33 36 C44 31.5 56 31.5 67 36 C69.5 46 68 55 66.5 64 C65 76 63.5 86 62.5 95 C63.5 103 61 109 50 110 C39 109 36.5 103 37.5 95 C36.5 86 35 76 33.5 64 C32 55 30.5 46 33 36 Z',
  // arms
  'M34 37 C28 38 25 44 25.5 51 C24 65 22 80 20.5 95 C19.5 108 19 119 19 128 C19 134 21.5 137 24.5 136 C27 135 28 132 28 126 C29 113 31 100 33 86 C35 71 36.5 57 38 49 C39 43 37.5 39 34 37 Z',
  'M66 37 C72 38 75 44 74.5 51 C76 65 78 80 79.5 95 C80.5 108 81 119 81 128 C81 134 78.5 137 75.5 136 C73 135 72 132 72 126 C71 113 69 100 67 86 C65 71 63.5 57 62 49 C61 43 62.5 39 66 37 Z',
  // legs
  'M38 99 C36.5 112 35.5 126 35 140 C34.5 152 34.5 162 35.5 172 C35 184 34.5 196 34.5 205 C34.5 212 35.5 216 37 217 C40 219 44 217 45 211 C46 197 47 178 47.5 160 C48 142 48.5 124 48.5 112 C45 111 41 107 38 99 Z',
  'M62 99 C63.5 112 64.5 126 65 140 C65.5 152 65.5 162 64.5 172 C65 184 65.5 196 65.5 205 C65.5 212 64.5 216 63 217 C60 219 56 217 55 211 C54 197 53 178 52.5 160 C52 142 51.5 124 51.5 112 C55 111 59 107 62 99 Z',
  // feet
  'M35 214 C34 219 35 223 39 223 L47 223 C48 220 47.5 216 46 213 Z',
  'M65 214 C66 219 65 223 61 223 L53 223 C52 220 52.5 216 54 213 Z',
]

// Muscle regions per view. Each id maps to one or more path outlines.
const FRONT_MUSCLES: Partial<Record<MuscleId, string[]>> = {
  traps: [
    'M46 29.5 C40 30.5 35 33 32.5 37 C39 35 45 35 48 36.5 Z',
    'M54 29.5 C60 30.5 65 33 67.5 37 C61 35 55 35 52 36.5 Z',
  ],
  sideDelts: [
    'M33 37 C27 38 24.5 44 25.5 51 C25.5 45 29 40 34 40 Z',
    'M67 37 C73 38 75.5 44 74.5 51 C74.5 45 71 40 66 40 Z',
  ],
  frontDelts: [
    'M34 37 C40 35 44 36 45 41 C45 46 41 48 36 47 C31.5 46 30.5 41 34 37 Z',
    'M66 37 C60 35 56 36 55 41 C55 46 59 48 64 47 C68.5 46 69.5 41 66 37 Z',
  ],
  chest: [
    'M49 40 L49 55 C42 58 34 55 33 48 C32.5 43 36 39 42 39 C45 39 47.5 39.5 49 40 Z',
    'M51 40 L51 55 C58 58 66 55 67 48 C67.5 43 64 39 58 39 C55 39 52.5 39.5 51 40 Z',
  ],
  biceps: [
    'M27 55 C24 57 22.5 64 22 72 C21.5 78 23 82 26 81 C29 80 30 74 30.5 66 C31 60 30 56 27 55 Z',
    'M73 55 C76 57 77.5 64 78 72 C78.5 78 77 82 74 81 C71 80 70 74 69.5 66 C69 60 70 56 73 55 Z',
  ],
  forearms: [
    'M25 86 C22.5 88 21 98 20.5 108 C20 116 21.5 122 24 121 C26.5 120 27.5 112 28 102 C28.5 94 27.5 88 25 86 Z',
    'M75 86 C77.5 88 79 98 79.5 108 C80 116 78.5 122 76 121 C73.5 120 72.5 112 72 102 C71.5 94 72.5 88 75 86 Z',
  ],
  abs: ['M50 57 C54 57 56 59 56 63 L56 92 C56 96 53 98 50 98 C47 98 44 96 44 92 L44 63 C44 59 46 57 50 57 Z'],
  obliques: [
    'M43 68 C40 69 38.5 76 38.5 84 C38.5 90 40 94 43 93 C43.5 85 43.5 76 43 68 Z',
    'M57 68 C60 69 61.5 76 61.5 84 C61.5 90 60 94 57 93 C56.5 85 56.5 76 57 68 Z',
  ],
  quads: [
    'M45 113 C40.5 116 38 130 38.5 146 C39 156 41 163 44.5 162 C47.5 161 48.5 148 49 132 C49 124 48 116 45 113 Z',
    'M55 113 C59.5 116 62 130 61.5 146 C61 156 59 163 55.5 162 C52.5 161 51.5 148 51 132 C51 124 52 116 55 113 Z',
  ],
}

const BACK_MUSCLES: Partial<Record<MuscleId, string[]>> = {
  traps: ['M50 30 C44 31 38 34 34 37 C41 39 46 45 48 52 L50 49 L52 52 C54 45 59 39 66 37 C62 34 56 31 50 30 Z'],
  rearDelts: [
    'M34 38 C28 39 25 45 26 52 C30 46 34 43 39 43 C38 40 36 38 34 38 Z',
    'M66 38 C72 39 75 45 74 52 C70 46 66 43 61 43 C62 40 64 38 66 38 Z',
  ],
  upperBack: ['M42 50 C46 49 54 49 58 50 C58 58 55 64 50 64 C45 64 42 58 42 50 Z'],
  lats: [
    'M40 56 C37 62 36.5 74 38 84 C42 80 45 74 46 66 C44.5 62 42.5 58 40 56 Z',
    'M60 56 C63 62 63.5 74 62 84 C58 80 55 74 54 66 C55.5 62 57.5 58 60 56 Z',
  ],
  triceps: [
    'M27 55 C24 57 22 65 21.5 74 C21 80 23 84 26 82 C29 80 30 73 30.5 65 C31 59 30 56 27 55 Z',
    'M73 55 C76 57 78 65 78.5 74 C79 80 77 84 74 82 C71 80 70 73 69.5 65 C69 59 70 56 73 55 Z',
  ],
  forearms: [
    'M25 86 C22.5 88 21 98 20.5 108 C20 116 21.5 122 24 121 C26.5 120 27.5 112 28 102 C28.5 94 27.5 88 25 86 Z',
    'M75 86 C77.5 88 79 98 79.5 108 C80 116 78.5 122 76 121 C73.5 120 72.5 112 72 102 C71.5 94 72.5 88 75 86 Z',
  ],
  lowerBack: ['M44 87 C47 86 53 86 56 87 C56 93 54 98 50 98 C46 98 44 93 44 87 Z'],
  glutes: [
    'M49 103 C46 104 42 108 42 114 C42 120 46 124 49 123 L49 103 Z',
    'M51 103 C54 104 58 108 58 114 C58 120 54 124 51 123 L51 103 Z',
  ],
  hamstrings: [
    'M45 126 C40.5 129 38.5 142 39 155 C39.5 164 41.5 170 45 169 C47.5 168 48.5 154 49 140 C49 133 48 128 45 126 Z',
    'M55 126 C59.5 129 61.5 142 61 155 C60.5 164 58.5 170 55 169 C52.5 168 51.5 154 51 140 C51 133 52 128 55 126 Z',
  ],
  calves: [
    'M42 171 C39 174 37.5 187 37.5 197 C37.5 205 40 209 43 208 C45.5 207 46 194 46 183 C46 177 44.5 171 42 171 Z',
    'M58 171 C61 174 62.5 187 62.5 197 C62.5 205 60 209 57 208 C54.5 207 54 194 54 183 C54 177 55.5 171 58 171 Z',
  ],
}

function Figure({
  act,
  muscles,
  label,
}: {
  act: ActivationMap
  muscles: Partial<Record<MuscleId, string[]>>
  label: string
}) {
  return (
    <svg viewBox="0 0 100 240" width="100%" height="100%" role="img" aria-label={label}>
      {/* head + neck + continuous body silhouette */}
      <g fill={C.skin} stroke={C.stroke} strokeWidth={0.6}>
        <ellipse cx={50} cy={15} rx={8.5} ry={10.5} />
        <path d="M45.5 23 C45.5 27 45 29 44.5 31 L55.5 31 C55 29 54.5 27 54.5 23 Z" />
        <ellipse cx={23.7} cy={139} rx={4.2} ry={6} />
        <ellipse cx={76.3} cy={139} rx={4.2} ry={6} />
        {BODY.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {/* muscle overlays */}
      {(Object.entries(muscles) as Array<[MuscleId, string[]]>).map(([id, ds]) => (
        <g key={id} fill={fillFor(act[id])} stroke={C.stroke} strokeWidth={0.5} style={{ transition: 'fill 0.2s ease' }}>
          {ds.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ))}
    </svg>
  )
}

export default function MuscleMap({ activation }: { activation: ActivationMap }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 160 }}>
          <div style={{ height: 280 }}>
            <Figure act={activation} muscles={FRONT_MUSCLES} label="Front muscles" />
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Front</div>
        </div>
        <div style={{ flex: 1, maxWidth: 160 }}>
          <div style={{ height: 280 }}>
            <Figure act={activation} muscles={BACK_MUSCLES} label="Back muscles" />
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
