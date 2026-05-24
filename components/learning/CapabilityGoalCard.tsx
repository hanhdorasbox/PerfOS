'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CapabilityGoal, LearningMilestone, LearningStep } from '@prisma/client'

type StepFull = LearningStep
type MilestoneFull = LearningMilestone & { steps: StepFull[] }

interface Props {
  goal: CapabilityGoal & { milestones: MilestoneFull[] }
}

const healthColors: Record<string, { color: string; bg: string; border: string; label: string }> = {
  not_started: { color: '#76746E', bg: 'rgba(118,116,110,0.08)', border: 'rgba(118,116,110,0.2)', label: 'Not Started' },
  on_track: { color: '#6BE3A4', bg: 'rgba(107,227,164,0.08)', border: 'rgba(107,227,164,0.2)', label: 'On Track' },
  at_risk: { color: '#F2C063', bg: 'rgba(242,192,99,0.08)', border: 'rgba(242,192,99,0.2)', label: 'At Risk' },
  behind: { color: '#FB923C', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', label: 'Behind' },
  stalled: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)', label: 'Stalled' },
  completed: { color: '#6BE3A4', bg: 'rgba(107,227,164,0.08)', border: 'rgba(107,227,164,0.2)', label: 'Completed' },
}

const roadmapTypeIcon: Record<string, string> = {
  skill: '🧠', career: '🚀', school: '🎓', portfolio: '🖼️',
  certification: '📜', project: '🔧', tool: '⚙️', exam: '📝',
}

export default function CapabilityGoalCard({ goal }: Props) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const allSteps = goal.milestones.flatMap(m => m.steps)
  const completedSteps = allSteps.filter(s => s.completed).length
  const totalSteps = allSteps.length

  // Fall back to milestone-based progress if no steps
  const completedMilestones = goal.milestones.filter(m => m.completed).length
  const totalMilestones = goal.milestones.length

  const progress = totalSteps > 0
    ? Math.round((completedSteps / totalSteps) * 100)
    : totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0

  const health = healthColors[goal.healthStatus || 'not_started']
  const isCompleted = goal.status === 'completed'
  const isArchived = goal.status === 'archived'

  // Next incomplete step across all milestones
  const nextStep = goal.milestones
    .flatMap(m => m.steps.filter(s => !s.completed).map(s => ({ ...s, milestoneTitle: m.title })))
    .sort((a, b) => a.order - b.order)[0]

  // Next incomplete milestone (if no steps)
  const nextMilestone = totalSteps === 0
    ? goal.milestones.find(m => !m.completed)
    : null

  async function deleteGoal() {
    setDeleting(true)
    try {
      await fetch(`/api/learning/goals/${goal.id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  async function archiveGoal() {
    setArchiving(true)
    try {
      await fetch(`/api/learning/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      router.refresh()
    } finally {
      setArchiving(false)
    }
  }

  async function restoreGoal() {
    await fetch(`/api/learning/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active', archivedAt: null }),
    })
    router.refresh()
  }

  const hasOutputMilestone = goal.milestones.some(m => m.type === 'output')
  const allKnowledge = goal.milestones.length > 0 && goal.milestones.every(m => m.type === 'knowledge')
  const showWarning = !isCompleted && !isArchived && (allKnowledge || (!hasOutputMilestone && goal.milestones.length > 0))

  return (
    <div className="card" style={{ opacity: isCompleted || isArchived ? 0.75 : 1, padding: '18px 22px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            {goal.roadmapType && (
              <span title={goal.roadmapType} style={{ fontSize: 15 }}>
                {roadmapTypeIcon[goal.roadmapType] || '🧠'}
              </span>
            )}
            {(isCompleted) && (
              <span style={{
                background: 'rgba(107,227,164,0.12)', color: '#6BE3A4',
                border: '1px solid rgba(107,227,164,0.25)',
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>✓ COMPLETED</span>
            )}
            {isArchived && (
              <span style={{
                background: 'rgba(118,116,110,0.12)', color: '#76746E',
                border: '1px solid rgba(118,116,110,0.25)',
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>ARCHIVED</span>
            )}
            {!isCompleted && !isArchived && (
              <span style={{
                background: health.bg, color: health.color, border: `1px solid ${health.border}`,
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>{health.label}</span>
            )}
            {goal.detailLevel === 'eli5' && !isCompleted && !isArchived && (
              <span style={{
                background: 'rgba(242,192,99,0.08)', color: '#F2C063',
                border: '1px solid rgba(242,192,99,0.2)',
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>ELI5</span>
            )}
          </div>
          <Link
            href={`/learning/${goal.id}`}
            style={{ textDecoration: 'none' }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', cursor: 'pointer' }}>
              {goal.title}
            </h3>
          </Link>
          <p style={{ color: '#B8B6B0', fontSize: 13, marginTop: 3 }}>{goal.capabilityStatement}</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Link
            href={`/learning/${goal.id}`}
            style={{
              background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.25)',
              color: '#B4A7E5', padding: '4px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'block',
            }}
          >
            View →
          </Link>
          {isArchived ? (
            <button
              onClick={restoreGoal}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#76746E', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Restore
            </button>
          ) : (
            !isCompleted && (
              <button
                onClick={archiveGoal}
                disabled={archiving}
                title="Archive"
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#76746E', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                }}
              >
                📦
              </button>
            )
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              style={{
                background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)',
                color: '#FF6B6B', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              }}
            >
              🗑
            </button>
          ) : (
            <>
              <button
                onClick={deleteGoal}
                disabled={deleting}
                style={{
                  background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)',
                  color: '#FF6B6B', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {deleting ? '...' : 'Delete?'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#76746E', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {/* Level progress bar */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#76746E', fontSize: 11 }}>L{goal.startingLevel}</span>
        <div style={{ flex: 1, display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 3,
              background: i <= goal.startingLevel
                ? '#76746E'
                : i <= goal.targetLevel
                ? '#B4A7E5'
                : 'rgba(255,255,255,0.06)',
            }} />
          ))}
        </div>
        <span style={{ color: '#B4A7E5', fontSize: 11 }}>L{goal.targetLevel}</span>
      </div>

      {/* Overall progress */}
      {(totalSteps > 0 || totalMilestones > 0) && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#76746E', fontSize: 11 }}>
              {totalSteps > 0
                ? `${completedSteps}/${totalSteps} steps`
                : `${completedMilestones}/${totalMilestones} milestones`}
            </span>
            <span style={{ color: '#76746E', fontSize: 11 }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: progress === 100 ? '#6BE3A4' : '#B4A7E5',
              borderRadius: 2, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Next best action / next step */}
      {!isCompleted && !isArchived && (nextStep || nextMilestone || goal.nextBestAction) && (
        <div style={{
          marginTop: 10,
          padding: '7px 12px',
          background: 'rgba(107,227,164,0.04)',
          border: '1px solid rgba(107,227,164,0.12)',
          borderRadius: 7,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>🎯</span>
          <div>
            <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next Action</p>
            <p style={{ color: '#B8B6B0', fontSize: 12, marginTop: 2 }}>
              {goal.nextBestAction || (nextStep ? `${nextStep.title}` : nextMilestone ? nextMilestone.title : '')}
            </p>
          </div>
        </div>
      )}

      {/* Meta info row */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {goal.weeklyHours && (
          <span style={{ color: '#76746E', fontSize: 11 }}>⏱ {goal.weeklyHours}h/week</span>
        )}
        {goal.deadline && (
          <span style={{ color: '#76746E', fontSize: 11 }}>
            📅 {new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {goal.milestones.length === 0 && !isCompleted && !isArchived && (
          <span style={{ color: '#76746E', fontSize: 11 }}>No roadmap — open to generate →</span>
        )}
      </div>

      {/* Warning: no output milestone */}
      {showWarning && (
        <div style={{
          marginTop: 10,
          background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.15)',
          borderRadius: 7, padding: '7px 11px',
        }}>
          <p style={{ color: '#F2C063', fontSize: 12 }}>
            ⚠️ No 'output' milestone — add one to produce something tangible.
          </p>
        </div>
      )}
    </div>
  )
}
