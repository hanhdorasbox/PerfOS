'use client'

// Pixel art avatar — 16×24 grid, each cell SZ px
// Asian woman, long black hair with dark-blonde ombre ends

const SZ = 5 // base pixel size

const COLOR: Record<string, string> = {
  H: '#0E0C0A', // very dark hair (near-black)
  m: '#4A3208', // mid ombre (dark brown)
  b: '#af7200', // dark blonde
  l: '#f7ac00', // golden blonde
  f: '#f58d49', // skin
  n: '#e46e2b', // neck / shadow skin
  s: '#cc5c14', // deep skin shadow
  e: '#261404', // eyebrow / lash
  y: '#1C0A02', // eye pupil
  w: '#f6e1a0', // eye white
  p: '#df5d5d', // upper lip
  P: '#c73939', // lower lip / shadow
  C: '#1E2D4A', // clothing dark navy
  c: '#2B3F68', // clothing mid
}

// 16 cols × 24 rows
const GRID: string[][] = [
  // 0 — hair crown
  ['.','.','.','H','H','H','H','H','H','H','H','H','H','.','.','.'],
  // 1
  ['.','.','H','H','H','H','H','H','H','H','H','H','H','H','.','.'],
  // 2 — full hair top
  ['.','H','H','H','H','H','H','H','H','H','H','H','H','H','H','.'],
  // 3 — forehead, hair frames face
  ['H','H','H','H','f','f','f','f','f','f','f','f','H','H','H','H'],
  // 4 — upper face
  ['H','H','H','f','f','f','f','f','f','f','f','f','H','H','H','H'],
  // 5 — eyebrows
  ['H','H','H','f','e','e','f','f','e','e','f','f','H','H','H','H'],
  // 6 — eyes (white · pupil · white)
  ['H','H','H','f','w','y','w','f','w','y','w','f','H','H','H','H'],
  // 7 — cheeks
  ['H','H','H','f','f','f','f','f','f','f','f','f','H','H','H','H'],
  // 8 — nose (subtle shadow hints)
  ['H','H','H','f','f','f','s','f','s','f','f','f','H','H','H','H'],
  // 9 — under nose
  ['H','H','H','f','f','f','f','f','f','f','f','f','H','H','H','H'],
  // 10 — upper lips
  ['H','H','H','f','f','p','p','p','p','p','f','f','H','H','H','H'],
  // 11 — lower lip / shadow
  ['H','H','H','f','f','P','p','p','p','f','f','f','H','H','H','H'],
  // 12 — chin
  ['H','H','H','H','f','f','f','f','f','f','H','H','H','H','H','H'],
  // 13 — neck
  ['H','H','H','H','H','n','n','n','n','H','H','H','H','H','H','H'],
  // 14 — shoulders / clothing starts
  ['H','H','H','C','C','C','C','C','C','C','C','H','H','H','H','H'],
  // 15 — body
  ['H','H','C','C','C','C','c','C','c','C','C','C','H','H','H','H'],
  // 16 — lower body, ombre starts on hair sides
  ['m','H','H','C','C','C','C','C','C','C','H','H','H','m','H','H'],
  // 17 — hair widens, more ombre
  ['m','m','H','H','C','C','C','C','C','H','H','H','m','m','H','H'],
  // 18 — long hair, mainly ombre visible
  ['m','m','m','H','H','H','H','H','H','H','H','m','m','m','H','H'],
  // 19 — mid ombre to dark blonde
  ['b','m','m','m','H','H','H','H','H','H','m','m','m','b','m','.'],
  // 20 — dark blonde spreading
  ['b','b','m','m','m','m','m','m','m','m','m','m','b','b','b','.'],
  // 21 — golden blonde
  ['l','b','b','b','b','m','m','m','m','b','b','b','b','l','b','.'],
  // 22 — mostly golden blonde
  ['l','l','b','b','b','b','b','b','b','b','b','b','l','l','l','.'],
  // 23 — lightest tips
  ['.','l','l','l','l','l','l','l','l','l','l','l','l','l','.','.'],
]

interface Props {
  /** Scale multiplier — 1 = 80×120 px, 2 = 160×240 px */
  scale?: number
  style?: React.CSSProperties
  className?: string
}

export default function PixelAvatar({ scale = 1, style, className }: Props) {
  const ps = SZ * scale          // rendered px per grid pixel
  const W  = 16 * ps
  const H  = 24 * ps

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${16 * SZ} ${24 * SZ}`}
      style={{ imageRendering: 'pixelated', display: 'block', ...style }}
      className={className}
      aria-label="Pixel avatar"
    >
      {GRID.map((row, ry) =>
        row.map((cell, cx) => {
          if (cell === '.') return null
          const fill = COLOR[cell]
          if (!fill) return null
          return (
            <rect
              key={`${ry}-${cx}`}
              x={cx * SZ}
              y={ry * SZ}
              width={SZ}
              height={SZ}
              fill={fill}
            />
          )
        })
      )}
    </svg>
  )
}
