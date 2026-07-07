'use client'

export default function Skel({ w, h = 12 }: { w: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 5,
      background: 'rgba(255,255,255,0.06)',
      animation: 'pulse 1.6s ease-in-out infinite',
      marginBottom: 6,
    }} />
  )
}
