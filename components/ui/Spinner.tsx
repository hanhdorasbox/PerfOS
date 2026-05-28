'use client'

interface SpinnerProps {
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

/**
 * Elegant SVG ring spinner.
 * Uses the `spin` keyframe defined in globals.css.
 */
export default function Spinner({
  size = 16,
  color = '#BF5AF2',
  strokeWidth = 2,
  style,
}: SpinnerProps) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const dashLen = circ * 0.27
  const gapLen = circ * 0.73

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ animation: 'spin 0.72s linear infinite', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth={strokeWidth}
      />
      {/* Arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLen} ${gapLen}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
