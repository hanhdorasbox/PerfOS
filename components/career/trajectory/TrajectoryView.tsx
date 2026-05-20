'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CareerTrajectory, TrajectoryGap, TrajectoryQuarterPlan } from '@prisma/client'

const gapTypeColors: Record<string, string> = {
  skill: '#60A5FA',
  proof_of_work: '#6BE3A4',
  scope: '#F2C063',
  visibility: '#B4A7E5',
  experience: '#FB923C',
}

interface Props {
  trajectory: CareerTrajectory & {
    gaps: TrajectoryGap[]
    quarterlyPlans: TrajectoryQuarterPlan[]
  }
  quarterId: string | null
  userId: string
}

export default function TrajectoryView({ trajectory, quarterId }: Props) {
  const router = useRouter()
  const [gaps, setGaps] = useState(trajectory.gaps)
  const [plans, setPlans] = useState(trajectory.quarterlyPlans)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [error, setError] = useState('')

  const openGaps = gaps.filter(g => !g.closed)
  const closedGaps = gaps.filter(g => g.closed)

  const gapsByType = openGaps.reduce((acc, g) => {
    if (!acc[g.gapType]) acc[g.gapType] = []
    acc[g.gapType].push(g)
    return acc
  }, {} as Record<string, TrajectoryGap[]>)

  async function closeGap(gapId: string) {
    const res = await fetch(`/api/career/trajectory/gaps/${gapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    })
    if (res.ok) {
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, closed: true, closedAt: new Date() } : g))
    }
  }

  async function generateQuarterPlan() {
    if (!quarterId) {
      setError('No active quarter found')
      return
    }
    setGeneratingPlan(true)
    setError('')
    try {
      const res = await fetch('/api/career/trajectory/quarter-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trajectoryId: trajectory.id, quarterId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setPlans(prev => [data.plan, ...prev])
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const latestPlan = plans[0]

  return (
    <div>
      {/* Target Role Banner */}
      <div className="card" style={{ background: 'rgba(180,167,229,0.08)', border: '1px solid rgba(180,167,229,0.2)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Target
            </p>
            <p style={{ color: '#FAFAFA', fontSize: 18, fontWeight: 700 }}>
              {trajectory.targetRoleTitle || trajectory.targetPath.replace(/_/g, ' ')}
            </p>
            <p style={{ color: '#B8B6B0', fontSize: 13, marginTop: 2 }}>
              from {trajectory.currentRole} → {trajectory.timeHorizon ?? 'TBD'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#76746E', fontSize: 12 }}>{openGaps.length} open gaps</p>
            <p style={{ color: '#6BE3A4', fontSize: 12 }}>{closedGaps.length} closed</p>
          </div>
        </div>
      </div>

      {/* Gap Tracker */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FAFAFA', marginBottom: 16 }}>Gap Tracker</h3>
        {openGaps.length === 0 ? (
          <p style={{ color: '#6BE3A4', fontSize: 14 }}>All gaps closed! Ready to define the next horizon.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {Object.entries(gapsByType).map(([type, typeGaps]) => (
              <div key={type}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    background: `${gapTypeColors[type] ?? '#76746E'}20`,
                    color: gapTypeColors[type] ?? '#76746E',
                    border: `1px solid ${gapTypeColors[type] ?? '#76746E'}40`,
                    padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    {type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: '#76746E', fontSize: 12 }}>{typeGaps.length}</span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {typeGaps.map(gap => (
                    <div key={gap.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <p style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{gap.title}</p>
                        {gap.description && (
                          <p style={{ color: '#76746E', fontSize: 12, marginTop: 2 }}>{gap.description}</p>
                        )}
                        <span style={{ color: gap.priority === 1 ? '#FF6B6B' : gap.priority === 2 ? '#F2C063' : '#76746E', fontSize: 11, fontWeight: 700 }}>
                          {gap.priority === 1 ? 'High' : gap.priority === 2 ? 'Medium' : 'Low'} priority
                        </span>
                      </div>
                      <button
                        onClick={() => closeGap(gap.id)}
                        style={{
                          background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)',
                          color: '#6BE3A4', padding: '4px 10px', borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Mark Closed ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quarter Plan */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FAFAFA' }}>Quarterly Career Plan</h3>
          <button
            onClick={generateQuarterPlan}
            disabled={generatingPlan}
            style={{
              background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
              color: '#B4A7E5', padding: '7px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: generatingPlan ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingPlan ? '⏳ Generating...' : '+ Generate Quarter Plan'}
          </button>
        </div>

        {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {!latestPlan ? (
          <p style={{ color: '#76746E', fontSize: 14 }}>No quarter plan yet. Generate one to get AI-recommended priorities.</p>
        ) : (
          <div>
            {latestPlan.priorities && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Priorities</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(JSON.parse(latestPlan.priorities) as string[]).map((p: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#B4A7E5', fontWeight: 700, fontSize: 13 }}>{i + 1}.</span>
                      <span style={{ color: '#FAFAFA', fontSize: 13 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latestPlan.keyOutput && (
              <div style={{ background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Key Output This Quarter</p>
                <p style={{ color: '#FAFAFA', fontSize: 13 }}>{latestPlan.keyOutput}</p>
              </div>
            )}
            {latestPlan.highUpsideBet && (
              <div style={{ background: 'rgba(242,192,99,0.08)', border: '1px solid rgba(242,192,99,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ color: '#F2C063', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>High-Upside Bet ⭐</p>
                <p style={{ color: '#FAFAFA', fontSize: 13 }}>{latestPlan.highUpsideBet}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
