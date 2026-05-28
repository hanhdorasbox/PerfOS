import Link from 'next/link'

interface FitnessLog { weight: number | null; waist: number | null }

export default function FitnessSummary({ fitnessLog, workoutsThisWeek }: { fitnessLog: FitnessLog | null, workoutsThisWeek: number }) {
  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>
        💪 Fitness
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {fitnessLog?.weight && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#F5F5F7' }}>{fitnessLog.weight} kg</div>
            <div style={{ fontSize: '11px', color: '#6E6E73' }}>weight</div>
          </div>
        )}
        {fitnessLog?.waist && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#F5F5F7' }}>{fitnessLog.waist} cm</div>
            <div style={{ fontSize: '11px', color: '#6E6E73' }}>waist</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: workoutsThisWeek >= 3 ? '#9FE7C0' : '#F3D58A' }}>{workoutsThisWeek}/3</div>
          <div style={{ fontSize: '11px', color: '#6E6E73' }}>workouts/week</div>
        </div>
      </div>
      <Link href="/fitness" style={{ display: 'block', marginTop: '12px', fontSize: '12px', color: '#6E6E73', textDecoration: 'none' }}>View fitness details →</Link>
    </div>
  )
}
