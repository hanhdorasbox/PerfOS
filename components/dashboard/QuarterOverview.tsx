interface Props {
  quarter: any
  qProgress: { pct: number; daysElapsed: number; daysTotal: number; daysRemaining: number }
  weightedCompletion: number
  goalCount: number
}

export default function QuarterOverview({ quarter, qProgress, weightedCompletion, goalCount }: Props) {
  const gap = weightedCompletion - qProgress.pct
  const onTrack = gap >= -5
  return (
    <div className="card" style={{ background: 'rgba(255,255,255,0.035)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '6px' }}>
            Active Quarter
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FAFAFA' }}>{quarter.name}</div>
          <div style={{ fontSize: '12px', color: '#76746E', marginTop: '3px' }}>
            {new Date(quarter.startDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })} – {new Date(quarter.endDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })} · {goalCount} goals
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '36px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: onTrack ? '#6BE3A4' : '#F2C063' }}>
            {Math.round(weightedCompletion)}%
          </div>
          <div style={{ fontSize: '11px', color: '#76746E' }}>weighted completion</div>
        </div>
      </div>

      {/* Quarter progress bar */}
      <div style={{ margin: '16px 0 8px' }}>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', position: 'relative', overflow: 'visible' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${qProgress.pct}%`, background: 'rgba(255,255,255,0.25)', borderRadius: '2px' }} />
          <div style={{ position: 'absolute', top: '-3px', left: `${Math.round(weightedCompletion)}%`, width: '10px', height: '10px', borderRadius: '50%', background: onTrack ? '#6BE3A4' : '#F2C063', transform: 'translateX(-50%)', boxShadow: `0 0 8px ${onTrack ? '#6BE3A4' : '#F2C063'}66` }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#76746E' }}>
        <span>Quarter: <b style={{ color: '#B8B6B0' }}>{Math.round(qProgress.pct)}%</b> elapsed</span>
        <span>Goals: <b style={{ color: '#B8B6B0' }}>{Math.round(weightedCompletion)}%</b> done</span>
        <span>Gap: <b style={{ color: gap >= 0 ? '#6BE3A4' : '#F2C063' }}>{gap >= 0 ? '+' : ''}{Math.round(gap)}%</b></span>
        <span><b style={{ color: '#B8B6B0' }}>{qProgress.daysRemaining}d</b> remaining</span>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#B8B6B0', padding: '10px 12px', background: onTrack ? 'rgba(107,227,164,0.05)' : 'rgba(242,192,99,0.05)', borderRadius: '8px', border: `1px solid ${onTrack ? 'rgba(107,227,164,0.15)' : 'rgba(242,192,99,0.15)'}` }}>
        {Math.round(qProgress.pct)}% of the quarter has passed. Weighted goal completion is {Math.round(weightedCompletion)}%. You are {onTrack ? 'on track' : `behind by ${Math.round(Math.abs(gap))}%`}.
      </div>
    </div>
  )
}
