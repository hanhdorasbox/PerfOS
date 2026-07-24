import RescuePlanButton from './RescuePlanButton'
import CountUp from '@/components/ui/CountUp'
import ActivityRings from './ActivityRings'

interface Props {
  quarter: any
  qProgress: { pct: number; daysElapsed: number; daysTotal: number; daysRemaining: number }
  weightedCompletion: number
  goalCount: number
  atRiskCount?: number
  watchCount?: number
  tasksDone?: number
  tasksTotal?: number
}

export default function QuarterOverview({
  quarter, qProgress, weightedCompletion, goalCount,
  atRiskCount = 0, watchCount = 0, tasksDone = 0, tasksTotal = 0,
}: Props) {
  const gap = weightedCompletion - qProgress.pct
  const onTrack = gap >= -5 && atRiskCount === 0
  const statusColor = onTrack ? '#64f0aa' : '#ffc648'
  const weeksRemaining = Math.ceil(qProgress.daysRemaining / 7)
  const tasksPct = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0

  const rings = [
    { pct: weightedCompletion, color: statusColor, label: 'Goals', value: `${Math.round(weightedCompletion)}%` },
    { pct: qProgress.pct, color: '#61adff', label: 'Quarter elapsed', value: `${Math.round(qProgress.pct)}%` },
    { pct: tasksPct, color: '#a085ff', label: 'Week tasks', value: tasksTotal > 0 ? `${tasksDone}/${tasksTotal}` : '—' },
  ]

  return (
    <div className="card" style={{ padding: '24px 26px' }}>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Activity rings */}
        <ActivityRings rings={rings} size={158} stroke={12} gap={5}>
          <div style={{
            fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: statusColor, lineHeight: 1, letterSpacing: '-0.04em',
          }}>
            <CountUp value={Math.round(weightedCompletion)} suffix="%" />
          </div>
          <div style={{ fontSize: 9, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
            goals
          </div>
        </ActivityRings>

        {/* Quarter info + legend */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#6E6E76', marginBottom: 6,
              }}>
                Active Quarter
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#EEEEF2', letterSpacing: '-0.025em' }}>
                {quarter.name}
              </div>
              <div style={{ fontSize: 13, color: '#6E6E76', marginTop: 4, letterSpacing: '-0.01em' }}>
                {new Date(quarter.startDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(quarter.endDate).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
                {' · '}{goalCount} goal{goalCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <StatItem label="Days remaining" value={`${qProgress.daysRemaining}d`} />
              <StatItem
                label="Progress gap"
                value={`${gap >= 0 ? '+' : ''}${Math.round(gap)}%`}
                valueColor={gap >= 0 ? '#64f0aa' : '#ffc648'}
              />
            </div>
          </div>

          {/* Ring legend */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
            {rings.map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#6E6E76' }}>{r.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9E9EA6', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Status note */}
          <div style={{
            fontSize: 13, color: '#9E9EA6', lineHeight: 1.55,
            padding: '9px 13px',
            background: onTrack ? 'rgba(100, 240, 170,0.06)' : 'rgba(255, 198, 72,0.06)',
            borderRadius: 12,
            border: `1px solid ${onTrack ? 'rgba(100, 240, 170,0.15)' : 'rgba(255, 198, 72,0.15)'}`,
          }}>
            {Math.round(qProgress.pct)}% of quarter elapsed.{' '}
            {onTrack
              ? <span style={{ color: '#64f0aa', fontWeight: 600 }}>On track.</span>
              : <span style={{ color: '#ffc648', fontWeight: 600 }}>
                  Behind by {Math.round(Math.abs(gap))}%.
                </span>
            }
            {atRiskCount > 0 && (
              <span style={{ color: '#ff8263', fontWeight: 600 }}> · {atRiskCount} {atRiskCount === 1 ? 'goal at risk' : 'goals at risk'}.</span>
            )}
            {watchCount > 0 && atRiskCount === 0 && (
              <span style={{ color: '#ffc648' }}> · {watchCount} {watchCount === 1 ? 'goal' : 'goals'} to watch.</span>
            )}
          </div>
        </div>
      </div>

      <RescuePlanButton
        gap={gap}
        weeksRemaining={weeksRemaining}
        quarterName={quarter.name}
      />
    </div>
  )
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6E6E76', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: valueColor ?? '#EEEEF2', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
