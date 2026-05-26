'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CapabilityGoal, LearningMilestone, LearningStep } from '@prisma/client'

type StepFull = LearningStep
type MilestoneFull = LearningMilestone & { steps: StepFull[] }
type GoalFull = CapabilityGoal & {
  milestones: MilestoneFull[]
  linkedGoal?: { id: string; title: string } | null
}

const stepTypeIcon: Record<string, string> = {
  read: '📖', watch: '▶️', practice: '⚡', build: '🔨', reflect: '💭', exercise: '💪',
}
const stepTypeColor: Record<string, string> = {
  read: '#60A5FA', watch: '#F472B6', practice: '#6BE3A4', build: '#B4A7E5', reflect: '#F2C063', exercise: '#FB923C',
}
const milestoneTypeColors: Record<string, string> = {
  knowledge: '#60A5FA', practice: '#6BE3A4', output: '#B4A7E5',
}
const healthColors: Record<string, { color: string; bg: string; label: string }> = {
  not_started: { color: '#76746E', bg: 'rgba(118,116,110,0.1)', label: 'Not Started' },
  on_track: { color: '#6BE3A4', bg: 'rgba(107,227,164,0.1)', label: 'On Track' },
  at_risk: { color: '#F2C063', bg: 'rgba(242,192,99,0.1)', label: 'At Risk' },
  behind: { color: '#FB923C', bg: 'rgba(251,146,60,0.1)', label: 'Behind' },
  stalled: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)', label: 'Stalled' },
  completed: { color: '#6BE3A4', bg: 'rgba(107,227,164,0.1)', label: 'Completed' },
}

interface Props {
  goal: GoalFull
}

export default function RoadmapDetailView({ goal: initialGoal }: Props) {
  const router = useRouter()
  const [goal, setGoal] = useState(initialGoal)
  const [activeTab, setActiveTab] = useState<'plan' | 'overview' | 'health'>('plan')
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(
    new Set(goal.milestones.filter(m => !m.completed).slice(0, 2).map(m => m.id))
  )

  const allSteps = goal.milestones.flatMap(m => m.steps)
  const completedSteps = allSteps.filter(s => s.completed).length
  const totalSteps = allSteps.length
  const completedMilestones = goal.milestones.filter(m => m.completed).length
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  const totalEstimatedHours = goal.milestones.reduce((sum, m) => sum + (m.estimatedHours || 0), 0)
  const completedHours = goal.milestones
    .filter(m => m.completed)
    .reduce((sum, m) => sum + (m.estimatedHours || 0), 0)
  const remainingHours = totalEstimatedHours - completedHours

  const health = healthColors[goal.healthStatus || 'not_started']

  async function completeStep(stepId: string, milestoneId: string) {
    const res = await fetch(`/api/learning/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    if (!res.ok) return
    setGoal(prev => {
      const updated = {
        ...prev,
        milestones: prev.milestones.map(m => {
          if (m.id !== milestoneId) return m
          const updatedSteps = m.steps.map(s => s.id === stepId ? { ...s, completed: true, completedAt: new Date() } : s)
          const allDone = updatedSteps.every(s => s.completed)
          return { ...m, steps: updatedSteps, completed: allDone, completedAt: allDone ? new Date() : m.completedAt }
        }),
      }
      // Auto-update health status
      const done = updated.milestones.flatMap(m => m.steps).filter(s => s.completed).length
      const total = updated.milestones.flatMap(m => m.steps).length
      const pct = total > 0 ? done / total : 0
      let newHealth = updated.healthStatus
      if (pct === 1) newHealth = 'completed'
      else if (pct > 0.6) newHealth = 'on_track'
      else if (pct > 0) newHealth = 'on_track'
      return { ...updated, healthStatus: newHealth }
    })
  }

  async function completeMilestone(milestoneId: string) {
    const res = await fetch(`/api/learning/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    if (!res.ok) return
    setGoal(prev => ({
      ...prev,
      milestones: prev.milestones.map(m =>
        m.id === milestoneId ? { ...m, completed: true, completedAt: new Date() } : m
      ),
    }))
  }

  async function regenerateRoadmap() {
    setRegenerating(true)
    setRegenError('')
    try {
      const res = await fetch(`/api/learning/goals/${goal.id}/roadmap`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        // Full reload — router.refresh() alone doesn't reset useState(initialGoal),
        // so the newly saved milestones+steps would never appear in the UI.
        window.location.reload()
      } else {
        setRegenError(data.error || 'Generation failed')
        setRegenerating(false)
      }
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Network error')
      setRegenerating(false)
    }
    // Note: no finally — on success we reload the page so state cleanup is irrelevant
  }

  async function deleteGoal() {
    setDeleting(true)
    try {
      await fetch(`/api/learning/goals/${goal.id}`, { method: 'DELETE' })
      router.push('/learning')
    } finally {
      setDeleting(false)
    }
  }

  async function archiveGoal() {
    await fetch(`/api/learning/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    router.push('/learning')
  }

  async function completeGoal() {
    await fetch(`/api/learning/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', healthStatus: 'completed' }),
    })
    router.refresh()
  }

  // Group milestones by phase
  const phases: { name: string; milestones: MilestoneFull[] }[] = []
  for (const m of goal.milestones) {
    const phase = m.phaseName || 'Milestones'
    const existing = phases.find(p => p.name === phase)
    if (existing) existing.milestones.push(m)
    else phases.push({ name: phase, milestones: [m] })
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '6px 10px', color: '#FAFAFA', fontSize: 13, width: '100%',
  }
  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#B8B6B0', padding: '5px 12px', borderRadius: 6, fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              {goal.roadmapType && (
                <span style={{
                  background: 'rgba(180,167,229,0.1)', color: '#B4A7E5',
                  border: '1px solid rgba(180,167,229,0.25)',
                  padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                }}>{goal.roadmapType}</span>
              )}
              <span style={{
                background: health.bg, color: health.color,
                border: `1px solid ${health.color}40`,
                padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>{health.label}</span>
              {goal.detailLevel === 'eli5' && (
                <span style={{
                  background: 'rgba(242,192,99,0.1)', color: '#F2C063',
                  border: '1px solid rgba(242,192,99,0.25)',
                  padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                }}>ELI5 MODE</span>
              )}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FAFAFA', marginBottom: 6 }}>{goal.title}</h1>
            <p style={{ color: '#B8B6B0', fontSize: 14 }}>{goal.capabilityStatement}</p>
          </div>

          {/* Action controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          {regenError && (
            <p style={{ color: '#FF6B6B', fontSize: 12, maxWidth: 280, textAlign: 'right' }}>⚠ {regenError}</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {goal.status === 'active' && (
              <>
                <button
                  onClick={completeGoal}
                  style={{ ...btnStyle, color: '#6BE3A4', border: '1px solid rgba(107,227,164,0.3)' }}
                >
                  ✓ Mark Complete
                </button>
                <button onClick={archiveGoal} style={btnStyle}>📦 Archive</button>
                <button
                  onClick={regenerateRoadmap}
                  disabled={regenerating}
                  style={{ ...btnStyle, color: '#B4A7E5', border: '1px solid rgba(180,167,229,0.3)' }}
                >
                  {regenerating ? '⏳ Regenerating...' : '✨ Regenerate'}
                </button>
              </>
            )}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ ...btnStyle, color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }}>
                🗑 Delete
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: '#FF6B6B', fontSize: 12 }}>Sure?</span>
                <button
                  onClick={deleteGoal}
                  disabled={deleting}
                  style={{ ...btnStyle, background: 'rgba(255,107,107,0.15)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.4)' }}
                >
                  {deleting ? '...' : 'Yes, delete'}
                </button>
                <button onClick={() => setConfirmDelete(false)} style={btnStyle}>Cancel</button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#76746E', fontSize: 12 }}>
              {completedSteps}/{totalSteps} steps · {completedMilestones}/{goal.milestones.length} milestones
            </span>
            <span style={{ color: '#B4A7E5', fontSize: 12, fontWeight: 600 }}>{overallProgress}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div style={{
              height: '100%', width: `${overallProgress}%`,
              background: overallProgress === 100 ? '#6BE3A4' : 'linear-gradient(90deg, #B4A7E5, #6BE3A4)',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Level</p>
            <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 3 }}>{goal.startingLevel} → {goal.targetLevel}</p>
          </div>
          <div>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Est. Hours</p>
            <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {totalEstimatedHours > 0 ? `${remainingHours.toFixed(0)}h left` : '—'}
            </p>
          </div>
          <div>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Weekly Hours</p>
            <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {goal.weeklyHours ? `${goal.weeklyHours}h` : '—'}
            </p>
          </div>
          <div>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Deadline</p>
            <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        {/* Next Best Action */}
        {goal.nextBestAction && (
          <div style={{
            marginTop: 14, background: 'rgba(107,227,164,0.06)',
            border: '1px solid rgba(107,227,164,0.2)', borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div>
              <p style={{ color: '#6BE3A4', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Best Action</p>
              <p style={{ color: '#FAFAFA', fontSize: 13, marginTop: 2 }}>{goal.nextBestAction}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['plan', 'overview', 'health'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: activeTab === tab ? '1px solid rgba(180,167,229,0.4)' : '1px solid transparent',
              background: activeTab === tab ? 'rgba(180,167,229,0.1)' : 'transparent',
              color: activeTab === tab ? '#B4A7E5' : '#76746E',
            }}
          >
            {tab === 'plan' ? '📋 Execution Plan' : tab === 'overview' ? '📌 Overview' : '🏥 Health'}
          </button>
        ))}
      </div>

      {/* ── Execution Plan Tab ── */}
      {activeTab === 'plan' && (
        <div>
          {goal.milestones.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <p style={{ color: '#76746E', fontSize: 15, marginBottom: 16 }}>No roadmap yet.</p>
              <button
                onClick={regenerateRoadmap}
                disabled={regenerating}
                style={{
                  background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
                  color: '#B4A7E5', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {regenerating ? '⏳ Generating...' : '✨ Generate Roadmap with AI'}
              </button>
            </div>
          )}

          {phases.map((phase, phIdx) => (
            <div key={phase.name} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(180,167,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#B4A7E5', flexShrink: 0 }}>
                  {phIdx + 1}
                </div>
                <h3 style={{ color: '#B4A7E5', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {phase.name}
                </h3>
                <div style={{ flex: 1, height: 1, background: 'rgba(180,167,229,0.15)' }} />
              </div>

              {phase.milestones.map(milestone => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  isExpanded={expandedMilestones.has(milestone.id)}
                  onToggle={() => setExpandedMilestones(prev => {
                    const next = new Set(prev)
                    if (next.has(milestone.id)) next.delete(milestone.id)
                    else next.add(milestone.id)
                    return next
                  })}
                  onCompleteStep={completeStep}
                  onCompleteMilestone={completeMilestone}
                  isGoalCompleted={goal.status === 'completed'}
                  onRegenerate={regenerateRoadmap}
                  regenerating={regenerating}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          {goal.whyItMatters && (
            <div>
              <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Why It Matters</p>
              <p style={{ color: '#FAFAFA', fontSize: 14 }}>{goal.whyItMatters}</p>
            </div>
          )}
          {goal.evidenceOfMastery && (
            <div style={{ background: 'rgba(107,227,164,0.06)', border: '1px solid rgba(107,227,164,0.15)', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Evidence of Mastery</p>
              <p style={{ color: '#FAFAFA', fontSize: 14 }}>{goal.evidenceOfMastery}</p>
            </div>
          )}
          {goal.finalOutput && (
            <div style={{ background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.15)', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Final Output</p>
              <p style={{ color: '#FAFAFA', fontSize: 14 }}>{goal.finalOutput}</p>
            </div>
          )}

          {/* Edit form */}
          <EditGoalForm goal={goal} onSave={updated => setGoal(prev => ({ ...prev, ...updated }))} inputStyle={inputStyle} />
        </div>
      )}

      {/* ── Health Tab ── */}
      {activeTab === 'health' && (
        <HealthTab goal={goal} onUpdateHealth={h => setGoal(prev => ({ ...prev, healthStatus: h, nextBestAction: prev.nextBestAction }))} />
      )}
    </div>
  )
}

// ── Milestone Card ────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone, isExpanded, onToggle, onCompleteStep, onCompleteMilestone, isGoalCompleted,
  onRegenerate, regenerating,
}: {
  milestone: MilestoneFull
  isExpanded: boolean
  onToggle: () => void
  onCompleteStep: (stepId: string, milestoneId: string) => void
  onCompleteMilestone: (milestoneId: string) => void
  isGoalCompleted: boolean
  onRegenerate?: () => void
  regenerating?: boolean
}) {
  const completedSteps = milestone.steps.filter(s => s.completed).length
  const totalSteps = milestone.steps.length
  const stepProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  const typeColor = milestoneTypeColors[milestone.type] ?? '#76746E'

  return (
    <div className="card" style={{ marginBottom: 8, padding: '14px 18px', opacity: milestone.completed ? 0.7 : 1 }}>
      {/* Milestone header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 12 }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 999, flexShrink: 0,
            background: milestone.completed ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${milestone.completed ? 'rgba(107,227,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            color: milestone.completed ? '#6BE3A4' : '#76746E',
          }}>
            {milestone.completed ? '✓' : '○'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ color: milestone.completed ? '#6BE3A4' : '#FAFAFA', fontSize: 14, fontWeight: 600 }}>
                {milestone.title}
              </span>
              <span style={{
                background: `${typeColor}20`, color: typeColor,
                border: `1px solid ${typeColor}40`,
                padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>{milestone.type}</span>
            </div>
            {milestone.description && (
              <p style={{ color: '#76746E', fontSize: 12 }}>{milestone.description}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {totalSteps > 0 && (
            <span style={{ color: '#76746E', fontSize: 12 }}>{completedSteps}/{totalSteps} steps</span>
          )}
          {milestone.estimatedHours && (
            <span style={{ color: '#76746E', fontSize: 11 }}>~{milestone.estimatedHours}h</span>
          )}
          <span style={{ color: '#76746E', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Step progress bar */}
      {totalSteps > 0 && (
        <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${stepProgress}%`,
            background: stepProgress === 100 ? '#6BE3A4' : typeColor,
            borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {isExpanded && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {milestone.steps.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {milestone.steps.map(step => (
                <StepRow
                  key={step.id}
                  step={step}
                  onComplete={() => onCompleteStep(step.id, milestone.id)}
                  isGoalCompleted={isGoalCompleted || milestone.completed}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#76746E', fontSize: 12 }}>No steps yet.</span>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  style={{
                    background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.25)',
                    color: '#B4A7E5', padding: '3px 10px', borderRadius: 6,
                    fontSize: 11, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {regenerating ? '⏳ Generating...' : '⚡ Generate steps'}
                </button>
              )}
            </div>
          )}

          {!milestone.completed && !isGoalCompleted && completedSteps === totalSteps && totalSteps > 0 && (
            <button
              onClick={() => onCompleteMilestone(milestone.id)}
              style={{
                marginTop: 12,
                background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)',
                color: '#6BE3A4', padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
              }}
            >
              ✓ Mark Milestone Complete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step Row ──────────────────────────────────────────────────────────────────

function StepRow({ step, onComplete, isGoalCompleted }: {
  step: StepFull
  onComplete: () => void
  isGoalCompleted: boolean
}) {
  const [showCriteria, setShowCriteria] = useState(false)
  const icon = stepTypeIcon[step.stepType] ?? '⚡'
  const color = stepTypeColor[step.stepType] ?? '#6BE3A4'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px',
      background: step.completed ? 'rgba(107,227,164,0.04)' : 'rgba(255,255,255,0.02)',
      borderRadius: 8,
      border: `1px solid ${step.completed ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.05)'}`,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{
              color: step.completed ? '#76746E' : '#FAFAFA',
              fontSize: 13,
              textDecoration: step.completed ? 'line-through' : 'none',
            }}>
              {step.title}
            </span>
            {step.description && (
              <p style={{ color: '#76746E', fontSize: 12, marginTop: 3 }}>{step.description}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                background: `${color}15`, color, border: `1px solid ${color}30`,
                padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600,
              }}>{step.stepType}</span>
              <span style={{ color: '#76746E', fontSize: 11 }}>~{step.estimatedMinutes} min</span>
              {step.suggestedDay && (
                <span style={{ color: '#76746E', fontSize: 11 }}>📅 {step.suggestedDay}</span>
              )}
              {step.completionCriteria && (
                <button
                  onClick={() => setShowCriteria(v => !v)}
                  style={{ background: 'none', border: 'none', color: '#76746E', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {showCriteria ? 'hide criteria' : 'done when?'}
                </button>
              )}
            </div>
            {showCriteria && step.completionCriteria && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(107,227,164,0.06)', borderRadius: 6, border: '1px solid rgba(107,227,164,0.15)' }}>
                <p style={{ color: '#6BE3A4', fontSize: 11 }}>✓ {step.completionCriteria}</p>
              </div>
            )}
          </div>
          {!step.completed && !isGoalCompleted && (
            <button
              onClick={onComplete}
              style={{
                background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)',
                color: '#6BE3A4', padding: '3px 10px', borderRadius: 5,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit Goal Form ─────────────────────────────────────────────────────────────

function EditGoalForm({ goal, onSave, inputStyle }: {
  goal: GoalFull
  onSave: (data: Partial<GoalFull>) => void
  inputStyle: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: goal.title,
    capabilityStatement: goal.capabilityStatement,
    whyItMatters: goal.whyItMatters || '',
    evidenceOfMastery: goal.evidenceOfMastery || '',
    finalOutput: goal.finalOutput || '',
    roadmapType: goal.roadmapType || '',
    weeklyHours: goal.weeklyHours?.toString() || '',
    deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
    detailLevel: goal.detailLevel || 'standard',
  })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/learning/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          weeklyHours: form.weeklyHours ? parseFloat(form.weeklyHours) : null,
          deadline: form.deadline || null,
        }),
      })
      if (res.ok) {
        const { goal: updated } = await res.json()
        onSave(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = { color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }

  if (!editing) {
    return (
      <div style={{ paddingTop: 4 }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#76746E', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✏️ Edit Goal Details
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ color: '#B4A7E5', fontSize: 13, fontWeight: 600 }}>Edit Goal Details</p>
      <div>
        <label style={labelStyle}>Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Capability Statement</label>
        <input value={form.capabilityStatement} onChange={e => setForm(f => ({ ...f, capabilityStatement: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Why It Matters</label>
        <input value={form.whyItMatters} onChange={e => setForm(f => ({ ...f, whyItMatters: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Roadmap Type</label>
          <select value={form.roadmapType} onChange={e => setForm(f => ({ ...f, roadmapType: e.target.value }))} style={inputStyle}>
            <option value="">None</option>
            {['skill', 'career', 'school', 'portfolio', 'certification', 'project', 'tool', 'exam'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Detail Level</label>
          <select value={form.detailLevel} onChange={e => setForm(f => ({ ...f, detailLevel: e.target.value }))} style={inputStyle}>
            <option value="standard">Standard</option>
            <option value="eli5">ELI5 (Super Detailed)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Weekly Hours</label>
          <input type="number" step="0.5" min="0.5" max="40" value={form.weeklyHours} onChange={e => setForm(f => ({ ...f, weeklyHours: e.target.value }))} style={inputStyle} placeholder="e.g. 5" />
        </div>
        <div>
          <label style={labelStyle}>Deadline</label>
          <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Evidence of Mastery</label>
        <input value={form.evidenceOfMastery} onChange={e => setForm(f => ({ ...f, evidenceOfMastery: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Final Output</label>
        <input value={form.finalOutput} onChange={e => setForm(f => ({ ...f, finalOutput: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
            color: '#B4A7E5', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#76746E', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Health Tab ────────────────────────────────────────────────────────────────

function HealthTab({ goal, onUpdateHealth }: {
  goal: GoalFull
  onUpdateHealth: (h: string) => void
}) {
  const allSteps = goal.milestones.flatMap(m => m.steps)
  const completedSteps = allSteps.filter(s => s.completed).length
  const totalSteps = allSteps.length
  const pct = totalSteps > 0 ? completedSteps / totalSteps : 0

  const completedMilestones = goal.milestones.filter(m => m.completed).length
  const totalMilestones = goal.milestones.length

  // Compute suggested health
  let suggestedHealth = 'not_started'
  if (pct === 1) suggestedHealth = 'completed'
  else if (pct > 0.5) suggestedHealth = 'on_track'
  else if (pct > 0) suggestedHealth = 'on_track'
  else suggestedHealth = 'not_started'

  async function setHealth(h: string) {
    await fetch(`/api/learning/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ healthStatus: h }),
    })
    onUpdateHealth(h)
  }

  const healthOptions = [
    { value: 'not_started', label: 'Not Started', desc: 'No progress yet' },
    { value: 'on_track', label: 'On Track', desc: 'Making steady progress toward deadline' },
    { value: 'at_risk', label: 'At Risk', desc: 'Slower than planned but recoverable' },
    { value: 'behind', label: 'Behind', desc: 'Significantly behind schedule' },
    { value: 'stalled', label: 'Stalled', desc: 'No activity in 2+ weeks' },
    { value: 'completed', label: 'Completed', desc: 'Fully mastered this capability' },
  ]

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <div>
        <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Progress Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Steps Done</p>
            <p style={{ color: '#FAFAFA', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{completedSteps}<span style={{ color: '#76746E', fontSize: 13 }}>/{totalSteps}</span></p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Milestones Done</p>
            <p style={{ color: '#FAFAFA', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{completedMilestones}<span style={{ color: '#76746E', fontSize: 13 }}>/{totalMilestones}</span></p>
          </div>
        </div>
        {suggestedHealth !== goal.healthStatus && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.2)', borderRadius: 7 }}>
            <p style={{ color: '#F2C063', fontSize: 12 }}>
              💡 Based on {Math.round(pct * 100)}% completion, suggested status: <strong>{suggestedHealth.replace('_', ' ')}</strong>
            </p>
          </div>
        )}
      </div>

      <div>
        <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Set Health Status</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {healthOptions.map(opt => {
            const hc = healthColors[opt.value]
            const isActive = goal.healthStatus === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setHealth(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: isActive ? hc.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? `${hc.color}40` : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 999, background: hc.color, flexShrink: 0 }} />
                <div>
                  <p style={{ color: isActive ? hc.color : '#FAFAFA', fontSize: 13, fontWeight: isActive ? 700 : 400 }}>{opt.label}</p>
                  <p style={{ color: '#76746E', fontSize: 11, marginTop: 1 }}>{opt.desc}</p>
                </div>
                {isActive && <span style={{ marginLeft: 'auto', color: hc.color, fontSize: 12 }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
