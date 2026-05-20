import Link from 'next/link'

interface FitnessLog { weight: number | null; waist: number | null }

export default function FitnessSummary({ fitnessLog, workoutsThisWeek }: { fitnessLog: FitnessLog | null, workoutsThisWeek: number }) {
  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>
        💪 Fitness
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {fitnessLog?.weight && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#FAFAFA' }}>{fitnessLog.weight} kg</div>
            <div style={{ fontSize: '11px', color: '#76746E' }}>weight</div>
          </div>
        )}
        {fitnessLog?.waist && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#FAFAFA' }}>{fitnessLog.waist} cm</div>
            <div style={{ fontSize: '11px', color: '#76746E' }}>waist</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: workoutsThisWeek >= 3 ? '#6BE3A4' : '#F2C063' }}>{workoutsThisWeek}/3</div>
          <div style={{ fontSize: '11px', color: '#76746E' }}>workouts/week</div>
        </div>
      </div>
      <Link href="/fitness" style={{ display: 'block', marginTop: '12px', fontSize: '12px', color: '#76746E', textDecoration: 'none' }}>View fitness details →</Link>
    </div>
  )
}
