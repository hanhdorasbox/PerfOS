// Life balance — how weighted progress and focus split across goal categories.
// Horizontal bars (the right form for magnitude-across-categories); one
// categorical colour per area assigned in fixed order (validated dataviz
// palette), never cycled — a 9th area folds into "Other" upstream.

const AREA_COLORS = ['#1f85ff', '#00b778', '#c98500', '#008300', '#7f6fff', '#ff4e4e', '#fc2a76', '#ff4900']

export interface LifeArea {
  name: string
  /** weighted progress %, 0–100 */
  progress: number
  /** share of total priority weight, 0–1 */
  share: number
  count: number
}

export default function LifeBalance({ areas }: { areas: LifeArea[] }) {
  if (areas.length === 0) return null

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6E6E76',
          marginBottom: 18,
        }}
      >
        Life balance
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {areas.map((a, i) => {
          const color = AREA_COLORS[i % AREA_COLORS.length]
          const pct = Math.max(0, Math.min(100, a.progress))
          return (
            <div key={a.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: '#EEEEF2', fontWeight: 500, letterSpacing: '-0.01em' }}>{a.name}</span>
                <span style={{ fontSize: 11, color: '#52525A' }}>
                  {a.count} goal{a.count !== 1 ? 's' : ''}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#EEEEF2',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(pct)}%
                </span>
              </div>

              {/* progress bar — magnitude in the area's colour */}
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div
                  className="progress-fill"
                  style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }}
                />
              </div>

              {/* focus share — how much of your attention this area gets */}
              <div style={{ fontSize: 10.5, color: '#52525A', marginTop: 6 }}>
                {Math.round(a.share * 100)}% of focus
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
