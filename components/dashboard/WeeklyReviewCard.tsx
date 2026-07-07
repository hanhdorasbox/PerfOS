interface Props {
  tasksDone: number
  tasksTotal: number
  progressLogs: number
  workouts: number
  proteinAvg: number | null
  proteinTarget: number | null
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{
        fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
        color: color ?? '#EEEEF2', fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#6E6E76', marginTop: 5, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  )
}

// Sunday-only reflection card: the week's numbers at a glance.
export default function WeeklyReviewCard({
  tasksDone, tasksTotal, progressLogs, workouts, proteinAvg, proteinTarget,
}: Props) {
  const completion = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0
  const completionColor = completion >= 80 ? '#7FD5AA' : completion >= 50 ? '#DDB96A' : '#E8907A'

  const summary =
    completion >= 80 ? 'Strong week. Carry the momentum into Monday.' :
    completion >= 50 ? 'Solid progress — a lighter plan next week might close the gap.' :
    tasksTotal === 0 ? 'Quiet week with no planned tasks. Set up next week tonight.' :
    'Tough week. Roll the essentials forward and start fresh.'

  return (
    <div className="card" style={{ borderColor: 'rgba(184,164,255,0.16)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B8A4FF' }}>
          Week in Review
        </div>
        <span style={{ fontSize: 10, color: '#52525A' }}>Sunday reflection</span>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat
          value={tasksTotal > 0 ? `${tasksDone}/${tasksTotal}` : '—'}
          label="tasks completed"
          color={tasksTotal > 0 ? completionColor : '#52525A'}
        />
        <Stat value={String(progressLogs)} label="goal updates logged" />
        <Stat value={String(workouts)} label="workouts" />
        <Stat
          value={proteinAvg != null ? `${proteinAvg}g` : '—'}
          label={proteinTarget ? `avg protein / ${proteinTarget}g` : 'avg protein'}
          color={proteinAvg != null && proteinTarget && proteinAvg >= proteinTarget ? '#7FD5AA' : undefined}
        />
      </div>

      <div style={{
        fontSize: 13, color: '#9E9EA6', lineHeight: 1.6,
        padding: '10px 14px', borderRadius: 12,
        background: 'rgba(184,164,255,0.05)', border: '1px solid rgba(184,164,255,0.12)',
      }}>
        {summary}
      </div>
    </div>
  )
}
