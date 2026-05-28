interface Props {
  quarter: any
  qProgress: { pct: number; daysElapsed: number; daysTotal: number; daysRemaining: number }
  weightedCompletion: number
  goalCount: number
}

export default function QuarterOverview({ quarter, qProgress, weightedCompletion, goalCount }: Props) {
  const gap = weightedCompletion - qProgress.pct
  const onTrack = gap >= -5
  const statusColor = onTrack ? '#30D158' : '#FFD60A'

  return (
    <div className="card" style={{ padding: '24px 26px' }}>

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#6E6E73', marginBottom: 6,
          }}>
            Active Quarter
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: '#F5F5F7', letterSpacing: '-0.025em',
          }}>
            {quarter.name}
          </div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 4, letterSpacing: '-0.01em' }}>
            {new Date(quarter.startDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(quarter.endDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
            {' · '}{goalCount} goal{goalCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 38, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: statusColor, lineHeight: 1, letterSpacing: '-0.04em',
          }}>
            {Math.round(weightedCompletion)}%
          </div>
          <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 4 }}>weighted completion</div>
        </div>
      </div>

      {/* Dual progress track */}
      <div style={{ marginBottom: 18 }}>
        {/* Quarter elapsed track */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6E6E73', marginBottom: 5 }}>
          <span>Quarter elapsed</span>
          <span>{Math.round(qProgress.pct)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
          <div className="progress-fill" style={{
            height: '100%', width: `${qProgress.pct}%`,
            borderRadius: 999, background: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Goals completion track */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6E6E73', marginBottom: 5 }}>
          <span>Goals completion</span>
          <span>{Math.round(weightedCompletion)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div className="progress-fill" style={{
            height: '100%', width: `${weightedCompletion}%`,
            borderRadius: 999, background: statusColor,
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <StatItem label="Days remaining" value={`${qProgress.daysRemaining}d`} />
        <StatItem
          label="Progress gap"
          value={`${gap >= 0 ? '+' : ''}${Math.round(gap)}%`}
          valueColor={gap >= 0 ? '#30D158' : '#FFD60A'}
        />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{
            fontSize: 13, color: '#A1A1A6', lineHeight: 1.55,
            padding: '9px 13px',
            background: onTrack ? 'rgba(48,209,88,0.06)' : 'rgba(255,214,10,0.06)',
            borderRadius: 12,
            border: `1px solid ${onTrack ? 'rgba(48,209,88,0.15)' : 'rgba(255,214,10,0.15)'}`,
          }}>
            {Math.round(qProgress.pct)}% of the quarter has passed.{' '}
            {onTrack
              ? <span style={{ color: '#30D158', fontWeight: 600 }}>On track.</span>
              : <span style={{ color: '#FFD60A', fontWeight: 600 }}>Behind by {Math.round(Math.abs(gap))}%.</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: valueColor ?? '#F5F5F7', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
