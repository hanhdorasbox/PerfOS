'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CapabilityGoal, LearningMilestone } from '@prisma/client'

const milestoneTypeColors: Record<string, string> = {
  knowledge: '#60A5FA',
  practice: '#6BE3A4',
  output: '#B4A7E5',
}

interface Props {
  goal: CapabilityGoal & { milestones: LearningMilestone[] }
}

export default function CapabilityGoalCard({ goal }: Props) {
  const router = useRouter()
  const [milestones, setMilestones] = useState(goal.milestones)
  const [expanded, setExpanded] = useState(goal.status === 'active')

  const hasOutputMilestone = milestones.some(m => m.type === 'output')
  const allKnowledge = milestones.length > 0 && milestones.every(m => m.type === 'knowledge')
  const showWarning = allKnowledge || (!hasOutputMilestone && milestones.length > 0)

  const completedCount = milestones.filter(m => m.completed).length
  const progress = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0

  async function completeMilestone(milestoneId: string) {
    const res = await fetch(`/api/learning/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    if (res.ok) {
      setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, completed: true, completedAt: new Date() } : m))
      // If all milestones done, suggest completion
      const allDone = milestones.filter(m => m.id !== milestoneId).every(m => m.completed)
      if (allDone) router.refresh()
    }
  }

  const isCompleted = goal.status === 'completed'

  return (
    <div className="card" style={{ opacity: isCompleted ? 0.7 : 1 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {isCompleted && (
              <span style={{
                background: 'rgba(107,227,164,0.15)', color: '#6BE3A4',
                border: '1px solid rgba(107,227,164,0.3)',
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>✓ COMPLETED</span>
            )}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>{goal.title}</h3>
          </div>
          <p style={{ color: '#B8B6B0', fontSize: 13 }}>{goal.capabilityStatement}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
          {milestones.length > 0 && (
            <span style={{ color: '#76746E', fontSize: 12 }}>{completedCount}/{milestones.length}</span>
          )}
          <span style={{ color: '#76746E', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Level progress bar */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#76746E', fontSize: 11 }}>Level {goal.startingLevel}</span>
        <div style={{ flex: 1, display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                flex: 1, height: 6, borderRadius: 3,
                background: i <= goal.startingLevel
                  ? '#76746E'
                  : i <= goal.targetLevel
                  ? '#B4A7E5'
                  : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
        <span style={{ color: '#B4A7E5', fontSize: 11 }}>Target {goal.targetLevel}</span>
      </div>

      {showWarning && (
        <div style={{
          marginTop: 10,
          background: 'rgba(242,192,99,0.08)', border: '1px solid rgba(242,192,99,0.2)',
          borderRadius: 8, padding: '8px 12px',
        }}>
          <p style={{ color: '#F2C063', fontSize: 12 }}>
            ⚠️ Add at least one 'output' milestone — consuming without producing leaves the value of this goal weak.
          </p>
        </div>
      )}

      {milestones.length > 0 && (
        <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: '#6BE3A4', borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {goal.whyItMatters && (
            <p style={{ color: '#76746E', fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: '#B8B6B0', fontWeight: 600 }}>Why it matters: </span>
              {goal.whyItMatters}
            </p>
          )}

          {goal.evidenceOfMastery && (
            <div style={{ background: 'rgba(107,227,164,0.06)', border: '1px solid rgba(107,227,164,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Evidence of Mastery</p>
              <p style={{ color: '#FAFAFA', fontSize: 13 }}>{goal.evidenceOfMastery}</p>
            </div>
          )}

          {goal.finalOutput && (
            <div style={{ background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <p style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Final Output</p>
              <p style={{ color: '#FAFAFA', fontSize: 13 }}>{goal.finalOutput}</p>
            </div>
          )}

          {milestones.length > 0 && (
            <div>
              <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Milestones</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {milestones.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px',
                    background: m.completed ? 'rgba(107,227,164,0.06)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 8, border: `1px solid ${m.completed ? 'rgba(107,227,164,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: m.completed ? '#6BE3A4' : '#76746E', fontSize: 14 }}>
                        {m.completed ? '✓' : '○'}
                      </span>
                      <span style={{ color: m.completed ? '#6BE3A4' : '#FAFAFA', fontSize: 13, textDecoration: m.completed ? 'line-through' : 'none' }}>
                        {m.title}
                      </span>
                      <span style={{
                        background: `${milestoneTypeColors[m.type] ?? '#76746E'}20`,
                        color: milestoneTypeColors[m.type] ?? '#76746E',
                        border: `1px solid ${milestoneTypeColors[m.type] ?? '#76746E'}40`,
                        padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      }}>
                        {m.type}
                      </span>
                    </div>
                    {!m.completed && !isCompleted && (
                      <button
                        onClick={() => completeMilestone(m.id)}
                        style={{
                          background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)',
                          color: '#6BE3A4', padding: '3px 10px', borderRadius: 6,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Done
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {milestones.length === 0 && (
            <p style={{ color: '#76746E', fontSize: 13 }}>No milestones yet.</p>
          )}
        </div>
      )}
    </div>
  )
}


