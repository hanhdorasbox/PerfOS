'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'
import type { CapabilityGoal, LearningMilestone, LearningStep } from '@prisma/client'

type StepFull = LearningStep
type MilestoneFull = LearningMilestone & { steps: StepFull[] }
type GoalFull = CapabilityGoal & {
  milestones: MilestoneFull[]
  linkedGoal?: { id: string; title: string } | null
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StrategicPhase {
  name: string
  timeline: string
  phasePurpose: string
  milestones: string[]
  weeklyTasks: string[]
  resources: string[]
  deliverable?: string
  successLook?: string
}

interface StrategicRoadmap {
  title: string
  summary: string
  capitalPotential: 'high' | 'medium' | 'low'
  capitalOutputs: string[]
  phases: StrategicPhase[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const stepTypeIcon: Record<string, string> = {
  read: '📖', watch: '▶️', practice: '⚡', build: '🔨', reflect: '💭', exercise: '💪',
}
const stepTypeColor: Record<string, string> = {
  read: '#0A84FF', watch: '#F472B6', practice: '#30D158', build: '#BF5AF2', reflect: '#FFD60A', exercise: '#FF9F0A',
}
const milestoneTypeColors: Record<string, string> = {
  knowledge: '#0A84FF', practice: '#30D158', output: '#BF5AF2',
}
const healthColors: Record<string, { color: string; bg: string; label: string }> = {
  not_started: { color: '#6E6E73', bg: 'rgba(118,116,110,0.1)', label: 'Not Started' },
  on_track:    { color: '#30D158', bg: 'rgba(107,227,164,0.1)', label: 'On Track' },
  at_risk:     { color: '#FFD60A', bg: 'rgba(242,192,99,0.1)',  label: 'At Risk' },
  behind:      { color: '#FF9F0A', bg: 'rgba(251,146,60,0.1)',  label: 'Behind' },
  stalled:     { color: '#FF453A', bg: 'rgba(255,107,107,0.1)', label: 'Stalled' },
  completed:   { color: '#30D158', bg: 'rgba(107,227,164,0.1)', label: 'Completed' },
}
const capitalColors: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: '#30D158', bg: 'rgba(107,227,164,0.1)',  border: 'rgba(107,227,164,0.3)' },
  medium: { color: '#FFD60A', bg: 'rgba(242,192,99,0.1)',   border: 'rgba(242,192,99,0.3)' },
  low:    { color: '#6E6E73', bg: 'rgba(118,116,110,0.1)',  border: 'rgba(118,116,110,0.3)' },
}
const phaseColors = ['#BF5AF2', '#30D158', '#FFD60A', '#0A84FF', '#FF9F0A', '#F472B6']

type Tab = 'overview' | 'roadmap' | 'plan' | 'health' | 'capital'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: '📌 Overview' },
  { id: 'roadmap',   label: '🗺 Roadmap' },
  { id: 'plan',      label: '📋 Execution Plan' },
  { id: 'health',    label: '🏥 Health' },
  { id: 'capital',   label: '💎 Capitalization' },
]

interface Props { goal: GoalFull }

export default function RoadmapDetailView({ goal: initialGoal }: Props) {
  const router = useRouter()
  const [goal, setGoal] = useState(initialGoal)

  const strategicRoadmap: StrategicRoadmap | null = (() => {
    try { return goal.strategicRoadmap ? JSON.parse(goal.strategicRoadmap) : null } catch { return null }
  })()

  const defaultTab: Tab = strategicRoadmap ? 'roadmap' : (goal.milestones.length > 0 ? 'plan' : 'overview')
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
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
  const totalEstHours = goal.milestones.reduce((s, m) => s + (m.estimatedHours || 0), 0)
  const completedHours = goal.milestones.filter(m => m.completed).reduce((s, m) => s + (m.estimatedHours || 0), 0)
  const health = healthColors[goal.healthStatus || 'not_started']

  // Group execution milestones by phase
  const phases: { name: string; milestones: MilestoneFull[] }[] = []
  for (const m of goal.milestones) {
    const name = m.phaseName || 'Milestones'
    const ex = phases.find(p => p.name === name)
    if (ex) ex.milestones.push(m)
    else phases.push({ name, milestones: [m] })
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function completeStep(stepId: string, milestoneId: string) {
    const res = await fetch(`/api/learning/steps/${stepId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
      const done = updated.milestones.flatMap(m => m.steps).filter(s => s.completed).length
      const total = updated.milestones.flatMap(m => m.steps).length
      const pct = total > 0 ? done / total : 0
      return { ...updated, healthStatus: pct === 1 ? 'completed' : pct > 0 ? 'on_track' : updated.healthStatus }
    })
  }

  async function completeMilestone(milestoneId: string) {
    const res = await fetch(`/api/learning/milestones/${milestoneId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    if (!res.ok) return
    setGoal(prev => ({ ...prev, milestones: prev.milestones.map(m => m.id === milestoneId ? { ...m, completed: true, completedAt: new Date() } : m) }))
  }

  async function regenerateRoadmap() {
    setRegenerating(true)
    setRegenError('')
    try {
      const res = await fetch(`/api/learning/goals/${goal.id}/roadmap`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) { window.location.reload() }
      else { setRegenError(data.error || 'Generation failed'); setRegenerating(false) }
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Network error')
      setRegenerating(false)
    }
  }

  async function deleteGoal() {
    setDeleting(true)
    try { await fetch(`/api/learning/goals/${goal.id}`, { method: 'DELETE' }); router.push('/learning') }
    finally { setDeleting(false) }
  }

  async function archiveGoal() {
    await fetch(`/api/learning/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) })
    router.push('/learning')
  }

  async function completeGoal() {
    await fetch(`/api/learning/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed', healthStatus: 'completed' }) })
    router.refresh()
  }

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#A1A1A6', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <div>
      {/* ── Header card ── */}
      <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {/* Chips row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {goal.roadmapType && (
                <span style={{ background: 'rgba(180,167,229,0.1)', color: '#BF5AF2', border: '1px solid rgba(180,167,229,0.25)', padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {goal.roadmapType}
                </span>
              )}
              <span style={{ background: health.bg, color: health.color, border: `1px solid ${health.color}40`, padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                {health.label}
              </span>
              {goal.capitalPotential && (
                <span style={{ ...capitalColors[goal.capitalPotential], padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, border: `1px solid ${capitalColors[goal.capitalPotential].border}` }}>
                  {goal.capitalPotential === 'high' ? '💎 High Capital' : goal.capitalPotential === 'medium' ? '⭐ Medium Capital' : '· Low Capital'}
                </span>
              )}
              {goal.detailLevel === 'eli5' && (
                <span style={{ background: 'rgba(242,192,99,0.1)', color: '#FFD60A', border: '1px solid rgba(242,192,99,0.25)', padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>ELI5</span>
              )}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F7', marginBottom: 5 }}>
              {strategicRoadmap?.title || goal.title}
            </h1>
            <p style={{ color: '#A1A1A6', fontSize: 14 }}>{goal.capabilityStatement}</p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
            {regenError && <p style={{ color: '#FF453A', fontSize: 12, maxWidth: 280, textAlign: 'right' }}>⚠ {regenError}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {goal.status === 'active' && (
                <>
                  <button onClick={completeGoal} style={{ ...btnStyle, color: '#30D158', border: '1px solid rgba(107,227,164,0.3)' }}>✓ Complete</button>
                  <button onClick={archiveGoal} style={btnStyle}>📦 Archive</button>
                  <button
                    onClick={regenerateRoadmap}
                    disabled={regenerating}
                    style={{ ...btnStyle, color: '#BF5AF2', border: '1px solid rgba(180,167,229,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {regenerating && <Spinner size={11} color="#BF5AF2" strokeWidth={2} />}
                    {regenerating ? 'Regenerating…' : '✨ Regenerate'}
                  </button>
                </>
              )}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ ...btnStyle, color: '#FF453A', border: '1px solid rgba(255,107,107,0.3)' }}>🗑 Delete</button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: '#FF453A', fontSize: 12 }}>Sure?</span>
                  <button onClick={deleteGoal} disabled={deleting} style={{ ...btnStyle, background: 'rgba(255,107,107,0.15)', color: '#FF453A', border: '1px solid rgba(255,107,107,0.4)' }}>
                    {deleting ? '…' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={btnStyle}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {totalSteps > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ color: '#6E6E73', fontSize: 12 }}>{completedSteps}/{totalSteps} steps · {completedMilestones}/{goal.milestones.length} milestones</span>
              <span style={{ color: '#BF5AF2', fontSize: 12, fontWeight: 600 }}>{overallProgress}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${overallProgress}%`, background: overallProgress === 100 ? '#30D158' : 'linear-gradient(90deg, #B4A7E5, #6BE3A4)', borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Level</p>
            <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 3 }}>{goal.startingLevel} → {goal.targetLevel}</p>
          </div>
          <div>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Hours left</p>
            <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {totalEstHours > 0 ? `${(totalEstHours - completedHours).toFixed(0)}h` : '—'}
            </p>
          </div>
          <div>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Weekly</p>
            <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 3 }}>{goal.weeklyHours ? `${goal.weeklyHours}h` : '—'}</p>
          </div>
          <div>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Deadline</p>
            <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
            </p>
          </div>
        </div>

        {/* Next Best Action */}
        {goal.nextBestAction && (
          <div style={{ marginTop: 14, background: 'rgba(107,227,164,0.06)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div>
              <p style={{ color: '#30D158', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Best Action</p>
              <p style={{ color: '#F5F5F7', fontSize: 13, marginTop: 2 }}>{goal.nextBestAction}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: activeTab === tab.id ? '1px solid rgba(180,167,229,0.4)' : '1px solid transparent',
              background: activeTab === tab.id ? 'rgba(180,167,229,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#BF5AF2' : '#6E6E73',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          {strategicRoadmap?.summary && (
            <div style={{ padding: '12px 14px', background: 'rgba(180,167,229,0.05)', borderRadius: 8, border: '1px solid rgba(180,167,229,0.15)' }}>
              <p style={{ color: '#BF5AF2', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Strategic Summary</p>
              <p style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.6 }}>{strategicRoadmap.summary}</p>
            </div>
          )}
          {goal.whyItMatters && (
            <div>
              <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Why It Matters</p>
              <p style={{ color: '#F5F5F7', fontSize: 14 }}>{goal.whyItMatters}</p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {goal.evidenceOfMastery && (
              <div style={{ background: 'rgba(107,227,164,0.06)', border: '1px solid rgba(107,227,164,0.15)', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ color: '#30D158', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Evidence of Mastery</p>
                <p style={{ color: '#F5F5F7', fontSize: 13 }}>{goal.evidenceOfMastery}</p>
              </div>
            )}
            {goal.finalOutput && (
              <div style={{ background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.15)', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ color: '#BF5AF2', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Final Output</p>
                <p style={{ color: '#F5F5F7', fontSize: 13 }}>{goal.finalOutput}</p>
              </div>
            )}
          </div>

          {/* Phase summary chips */}
          {strategicRoadmap?.phases && strategicRoadmap.phases.length > 0 && (
            <div>
              <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Phases</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {strategicRoadmap.phases.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab('roadmap')}
                    style={{
                      fontSize: 12, padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                      background: `${phaseColors[i % phaseColors.length]}18`,
                      color: phaseColors[i % phaseColors.length],
                      border: `1px solid ${phaseColors[i % phaseColors.length]}30`,
                      fontWeight: 600,
                    }}
                  >
                    {p.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>{p.timeline}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <EditGoalForm goal={goal} onSave={updated => setGoal(prev => ({ ...prev, ...updated }))} />
        </div>
      )}

      {/* ── ROADMAP TAB ── */}
      {activeTab === 'roadmap' && (
        <div>
          {!strategicRoadmap ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <p style={{ color: '#6E6E73', fontSize: 15, marginBottom: 8 }}>No strategic roadmap yet.</p>
              <p style={{ color: '#4A4845', fontSize: 13, marginBottom: 20 }}>Generate a roadmap to see the full strategic picture — phases, milestones, resources and deliverables.</p>
              <button
                onClick={regenerateRoadmap}
                disabled={regenerating}
                style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)', color: '#BF5AF2', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {regenerating && <Spinner size={13} color="#BF5AF2" strokeWidth={2} />}
                {regenerating ? 'Generating…' : '✨ Generate AI Roadmap'}
              </button>
            </div>
          ) : (
            <div>
              {/* Summary + phase chips */}
              <div className="card" style={{ marginBottom: 12 }}>
                <p style={{ color: '#A1A1A6', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{strategicRoadmap.summary}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {strategicRoadmap.phases.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: `${phaseColors[i % phaseColors.length]}18`, color: phaseColors[i % phaseColors.length], border: `1px solid ${phaseColors[i % phaseColors.length]}30` }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Phase cards */}
              {strategicRoadmap.phases.map((phase, i) => (
                <StrategicPhaseCard key={i} phase={phase} index={i} color={phaseColors[i % phaseColors.length]} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EXECUTION PLAN TAB ── */}
      {activeTab === 'plan' && (
        <div>
          {goal.milestones.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <p style={{ color: '#6E6E73', fontSize: 15, marginBottom: 16 }}>No execution plan yet.</p>
              <button
                onClick={regenerateRoadmap}
                disabled={regenerating}
                style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)', color: '#BF5AF2', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {regenerating && <Spinner size={13} color="#BF5AF2" strokeWidth={2} />}
                {regenerating ? 'Generating…' : '✨ Generate with AI'}
              </button>
            </div>
          ) : (
            phases.map((phase, phIdx) => (
              <div key={phase.name} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: `${phaseColors[phIdx % phaseColors.length]}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: phaseColors[phIdx % phaseColors.length], flexShrink: 0 }}>
                    {phIdx + 1}
                  </div>
                  <h3 style={{ color: phaseColors[phIdx % phaseColors.length], fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{phase.name}</h3>
                  <div style={{ flex: 1, height: 1, background: `${phaseColors[phIdx % phaseColors.length]}25` }} />
                </div>
                {phase.milestones.map(milestone => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    phaseColor={phaseColors[phIdx % phaseColors.length]}
                    isExpanded={expandedMilestones.has(milestone.id)}
                    onToggle={() => setExpandedMilestones(prev => {
                      const next = new Set(prev)
                      if (next.has(milestone.id)) { next.delete(milestone.id) } else { next.add(milestone.id) }
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
            ))
          )}
        </div>
      )}

      {/* ── HEALTH TAB ── */}
      {activeTab === 'health' && (
        <HealthTab goal={goal} onUpdateHealth={h => setGoal(prev => ({ ...prev, healthStatus: h }))} />
      )}

      {/* ── CAPITALIZATION TAB ── */}
      {activeTab === 'capital' && (
        <CapitalizationTab goal={goal} strategicRoadmap={strategicRoadmap} />
      )}
    </div>
  )
}

// ── Strategic Phase Card ──────────────────────────────────────────────────────

function StrategicPhaseCard({ phase, index, color }: { phase: StrategicPhase; index: number; color: string }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div style={{ marginBottom: 10, borderLeft: `3px solid ${color}50`, paddingLeft: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '10px 0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color }}>{phase.name}</span>
            <span style={{ fontSize: 11, color: '#6E6E73', marginLeft: 10 }}>{phase.timeline}</span>
          </div>
          <span style={{ color: '#6E6E73', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
        <p style={{ fontSize: 13, color: '#A1A1A6', marginTop: 3, lineHeight: 1.5 }}>{phase.phasePurpose}</p>
      </button>

      {open && (
        <div style={{ paddingBottom: 16, display: 'grid', gap: 14 }}>
          {phase.milestones?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 7 }}>Milestones</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.milestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color, fontSize: 11, flexShrink: 0, marginTop: 2 }}>◆</span>
                    <span style={{ fontSize: 13, color: '#F5F5F7', lineHeight: 1.5 }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase.weeklyTasks?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 7 }}>Weekly Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.weeklyTasks.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#6E6E73', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase.resources?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 7 }}>Resources</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {phase.resources.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#6E6E73' }}>📖 {r}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {phase.deliverable && (
              <div style={{ padding: '10px 12px', background: `${color}08`, borderRadius: 8, border: `1px solid ${color}20` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Deliverable</div>
                <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.5 }}>{phase.deliverable}</p>
              </div>
            )}
            {phase.successLook && (
              <div style={{ padding: '10px 12px', background: 'rgba(107,227,164,0.05)', borderRadius: 8, border: '1px solid rgba(107,227,164,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Done when</div>
                <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.5 }}>{phase.successLook}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Milestone Card ────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone, phaseColor, isExpanded, onToggle, onCompleteStep, onCompleteMilestone,
  isGoalCompleted, onRegenerate, regenerating,
}: {
  milestone: MilestoneFull
  phaseColor: string
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
  const typeColor = milestoneTypeColors[milestone.type] ?? '#6E6E73'

  return (
    <div className="card" style={{ marginBottom: 8, padding: '14px 18px', opacity: milestone.completed ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 12 }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: milestone.completed ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${milestone.completed ? 'rgba(107,227,164,0.4)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: milestone.completed ? '#30D158' : '#6E6E73' }}>
            {milestone.completed ? '✓' : '○'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ color: milestone.completed ? '#30D158' : '#F5F5F7', fontSize: 14, fontWeight: 600 }}>{milestone.title}</span>
              <span style={{ background: `${typeColor}20`, color: typeColor, border: `1px solid ${typeColor}40`, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{milestone.type}</span>
            </div>
            {milestone.description && <p style={{ color: '#6E6E73', fontSize: 12 }}>{milestone.description}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {totalSteps > 0 && <span style={{ color: '#6E6E73', fontSize: 12 }}>{completedSteps}/{totalSteps}</span>}
          {milestone.estimatedHours && <span style={{ color: '#6E6E73', fontSize: 11 }}>~{milestone.estimatedHours}h</span>}
          <span style={{ color: '#6E6E73', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {totalSteps > 0 && (
        <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${stepProgress}%`, background: stepProgress === 100 ? '#30D158' : phaseColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}

      {isExpanded && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {milestone.steps.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {milestone.steps.map(step => (
                <StepRow key={step.id} step={step} onComplete={() => onCompleteStep(step.id, milestone.id)} isGoalCompleted={isGoalCompleted || milestone.completed} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#6E6E73', fontSize: 12 }}>No steps yet.</span>
              {onRegenerate && (
                <button onClick={onRegenerate} disabled={regenerating} style={{ background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.25)', color: '#BF5AF2', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer' }}>
                  {regenerating ? '⏳ Generating…' : '⚡ Generate steps'}
                </button>
              )}
            </div>
          )}
          {!milestone.completed && !isGoalCompleted && completedSteps === totalSteps && totalSteps > 0 && (
            <button onClick={() => onCompleteMilestone(milestone.id)} style={{ marginTop: 12, background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)', color: '#30D158', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              ✓ Mark Milestone Complete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step Row ──────────────────────────────────────────────────────────────────

function StepRow({ step, onComplete, isGoalCompleted }: { step: StepFull; onComplete: () => void; isGoalCompleted: boolean }) {
  const [showCriteria, setShowCriteria] = useState(false)
  const icon = stepTypeIcon[step.stepType] ?? '⚡'
  const color = stepTypeColor[step.stepType] ?? '#30D158'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: step.completed ? 'rgba(107,227,164,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${step.completed ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: step.completed ? '#6E6E73' : '#F5F5F7', fontSize: 13, textDecoration: step.completed ? 'line-through' : 'none' }}>{step.title}</span>
            {step.description && <p style={{ color: '#6E6E73', fontSize: 12, marginTop: 3 }}>{step.description}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ background: `${color}15`, color, border: `1px solid ${color}30`, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{step.stepType}</span>
              <span style={{ color: '#6E6E73', fontSize: 11 }}>~{step.estimatedMinutes} min</span>
              {step.suggestedDay && <span style={{ color: '#6E6E73', fontSize: 11 }}>📅 {step.suggestedDay}</span>}
              {step.completionCriteria && (
                <button onClick={() => setShowCriteria(v => !v)} style={{ background: 'none', border: 'none', color: '#6E6E73', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  {showCriteria ? 'hide criteria' : 'done when?'}
                </button>
              )}
            </div>
            {showCriteria && step.completionCriteria && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(107,227,164,0.06)', borderRadius: 6, border: '1px solid rgba(107,227,164,0.15)' }}>
                <p style={{ color: '#30D158', fontSize: 11 }}>✓ {step.completionCriteria}</p>
              </div>
            )}
          </div>
          {!step.completed && !isGoalCompleted && (
            <button onClick={onComplete} style={{ background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)', color: '#30D158', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Health Tab ────────────────────────────────────────────────────────────────

function HealthTab({ goal, onUpdateHealth }: { goal: GoalFull; onUpdateHealth: (h: string) => void }) {
  const allSteps = goal.milestones.flatMap(m => m.steps)
  const completedSteps = allSteps.filter(s => s.completed).length
  const totalSteps = allSteps.length
  const pct = totalSteps > 0 ? completedSteps / totalSteps : 0
  const completedMilestones = goal.milestones.filter(m => m.completed).length
  const totalMilestones = goal.milestones.length
  const suggestedHealth = pct === 1 ? 'completed' : pct > 0 ? 'on_track' : 'not_started'

  const healthOptions = [
    { value: 'not_started', label: 'Not Started',  desc: 'No progress yet' },
    { value: 'on_track',    label: 'On Track',      desc: 'Making steady progress toward deadline' },
    { value: 'at_risk',     label: 'At Risk',       desc: 'Slower than planned but recoverable' },
    { value: 'behind',      label: 'Behind',        desc: 'Significantly behind schedule' },
    { value: 'stalled',     label: 'Stalled',       desc: 'No activity in 2+ weeks' },
    { value: 'completed',   label: 'Completed',     desc: 'Fully mastered this capability' },
  ]

  async function setHealth(h: string) {
    await fetch(`/api/learning/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ healthStatus: h }) })
    onUpdateHealth(h)
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <div>
        <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Progress Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Steps Done</p>
            <p style={{ color: '#F5F5F7', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{completedSteps}<span style={{ color: '#6E6E73', fontSize: 13 }}>/{totalSteps}</span></p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Milestones Done</p>
            <p style={{ color: '#F5F5F7', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{completedMilestones}<span style={{ color: '#6E6E73', fontSize: 13 }}>/{totalMilestones}</span></p>
          </div>
        </div>
        {suggestedHealth !== goal.healthStatus && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.2)', borderRadius: 7 }}>
            <p style={{ color: '#FFD60A', fontSize: 12 }}>💡 Based on {Math.round(pct * 100)}% completion, suggested: <strong>{suggestedHealth.replace('_', ' ')}</strong></p>
          </div>
        )}
      </div>
      <div>
        <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Set Health Status</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {healthOptions.map(opt => {
            const hc = healthColors[opt.value]
            const isActive = goal.healthStatus === opt.value
            return (
              <button key={opt.value} onClick={() => setHealth(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: isActive ? hc.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? `${hc.color}40` : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: hc.color, flexShrink: 0 }} />
                <div>
                  <p style={{ color: isActive ? hc.color : '#F5F5F7', fontSize: 13, fontWeight: isActive ? 700 : 400 }}>{opt.label}</p>
                  <p style={{ color: '#6E6E73', fontSize: 11, marginTop: 1 }}>{opt.desc}</p>
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

// ── Capitalization Tab ────────────────────────────────────────────────────────

function CapitalizationTab({ goal, strategicRoadmap }: { goal: GoalFull; strategicRoadmap: StrategicRoadmap | null }) {
  const [converting, setConverting] = useState(false)
  const [converted, setConverted] = useState<string[]>([])
  const [convertError, setConvertError] = useState('')

  const capPotential = goal.capitalPotential || strategicRoadmap?.capitalPotential
  const capitalOutputs = strategicRoadmap?.capitalOutputs ?? []
  const capStyle = capPotential ? capitalColors[capPotential] : null

  async function convertToCareerCapital() {
    if (!goal.userId) return
    setConverting(true)
    setConvertError('')
    try {
      const items: string[] = []
      // Create a Career Capital item for each output
      const outputsToConvert = capitalOutputs.length > 0
        ? capitalOutputs
        : [goal.finalOutput || goal.capabilityStatement]

      for (const output of outputsToConvert) {
        const res = await fetch('/api/career/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: goal.userId,
            category: 'internal',
            type: 'proof_of_work',
            title: output,
            impact: `From learning: ${goal.title}`,
          }),
        })
        if (res.ok) items.push(output)
      }
      setConverted(items)
    } catch {
      setConvertError('Failed to convert — try again')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Capital potential */}
      {capPotential && capStyle && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 24 }}>{capPotential === 'high' ? '💎' : capPotential === 'medium' ? '⭐' : '·'}</span>
            <div>
              <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capital Potential</p>
              <span style={{ ...capStyle, padding: '3px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: `1px solid ${capStyle.border}`, display: 'inline-block', marginTop: 4 }}>
                {capPotential.charAt(0).toUpperCase() + capPotential.slice(1)}
              </span>
            </div>
          </div>
          {capPotential === 'high' && (
            <p style={{ color: '#A1A1A6', fontSize: 13, lineHeight: 1.6 }}>
              This learning can create reusable, verifiable proof that others can see — portfolio items, certifications, or demonstrated skills with evidence.
            </p>
          )}
          {capPotential === 'medium' && (
            <p style={{ color: '#A1A1A6', fontSize: 13, lineHeight: 1.6 }}>
              This learning improves your capabilities but has limited external proof. Creating an output or case study will increase the capital value.
            </p>
          )}
          {capPotential === 'low' && (
            <p style={{ color: '#A1A1A6', fontSize: 13, lineHeight: 1.6 }}>
              This is primarily internal knowledge. To create career capital, you&apos;ll need to produce a tangible output or evidence of the skill.
            </p>
          )}
        </div>
      )}

      {/* Career capital outputs */}
      {(capitalOutputs.length > 0 || goal.finalOutput || goal.evidenceOfMastery) && (
        <div className="card">
          <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>What This Learning Can Create</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {capitalOutputs.map((output, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#30D158', fontSize: 14, flexShrink: 0, marginTop: 1 }}>◆</span>
                <span style={{ fontSize: 13, color: '#F5F5F7' }}>{output}</span>
              </div>
            ))}
            {capitalOutputs.length === 0 && goal.finalOutput && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#BF5AF2', fontSize: 14, flexShrink: 0, marginTop: 1 }}>◆</span>
                <span style={{ fontSize: 13, color: '#F5F5F7' }}>{goal.finalOutput}</span>
              </div>
            )}
          </div>

          {/* Important note */}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.15)', borderRadius: 8 }}>
            <p style={{ color: '#FFD60A', fontSize: 12, lineHeight: 1.5 }}>
              ⚠ Passive learning alone does not create career capital. Capital is created only when there is evidence, output, or demonstrated skill that others can verify.
            </p>
          </div>
        </div>
      )}

      {/* Proof required */}
      {goal.evidenceOfMastery && (
        <div className="card">
          <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Proof Required to Close Gap</p>
          <div style={{ padding: '10px 12px', background: 'rgba(107,227,164,0.05)', borderRadius: 8, border: '1px solid rgba(107,227,164,0.15)' }}>
            <p style={{ color: '#F5F5F7', fontSize: 13 }}>{goal.evidenceOfMastery}</p>
          </div>
        </div>
      )}

      {/* Convert button */}
      <div className="card">
        <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Convert Output to Career Capital</p>
        <p style={{ color: '#A1A1A6', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          When you have produced proof or a tangible output, add it to your Career Capital inventory.
        </p>

        {converted.length > 0 ? (
          <div style={{ padding: '12px 14px', background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 8 }}>
            <p style={{ color: '#30D158', fontSize: 13, fontWeight: 600 }}>✓ Added {converted.length} item{converted.length !== 1 ? 's' : ''} to Career Capital</p>
            {converted.map((c, i) => <p key={i} style={{ color: '#A1A1A6', fontSize: 12, marginTop: 4 }}>· {c}</p>)}
          </div>
        ) : (
          <button
            onClick={convertToCareerCapital}
            disabled={converting || capitalOutputs.length === 0 && !goal.finalOutput}
            style={{
              padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.3)', color: '#30D158',
              opacity: converting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {converting && <Spinner size={13} color="#30D158" strokeWidth={2} />}
            {converting ? 'Adding…' : '💎 Convert Output to Career Capital'}
          </button>
        )}
        {convertError && <p style={{ color: '#FF453A', fontSize: 12, marginTop: 8 }}>{convertError}</p>}
      </div>
    </div>
  )
}

// ── Edit Goal Form ─────────────────────────────────────────────────────────────

function EditGoalForm({ goal, onSave }: { goal: GoalFull; onSave: (data: Partial<GoalFull>) => void }) {
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

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: '#F5F5F7', fontSize: 13, width: '100%' }
  const labelStyle: React.CSSProperties = { color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/learning/goals/${goal.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, weeklyHours: form.weeklyHours ? parseFloat(form.weeklyHours) : null, deadline: form.deadline || null }),
      })
      if (res.ok) { const { goal: updated } = await res.json(); onSave(updated); setEditing(false) }
    } finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        ✏️ Edit Goal Details
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ color: '#BF5AF2', fontSize: 13, fontWeight: 600 }}>Edit Goal Details</p>
      <div><label style={labelStyle}>Title</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
      <div><label style={labelStyle}>Capability Statement</label><input value={form.capabilityStatement} onChange={e => setForm(f => ({ ...f, capabilityStatement: e.target.value }))} style={inputStyle} /></div>
      <div><label style={labelStyle}>Why It Matters</label><input value={form.whyItMatters} onChange={e => setForm(f => ({ ...f, whyItMatters: e.target.value }))} style={inputStyle} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Roadmap Type</label>
          <select value={form.roadmapType} onChange={e => setForm(f => ({ ...f, roadmapType: e.target.value }))} style={inputStyle}>
            <option value="">None</option>
            {['skill', 'career', 'school', 'portfolio', 'certification', 'project', 'tool', 'exam'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Detail Level</label>
          <select value={form.detailLevel} onChange={e => setForm(f => ({ ...f, detailLevel: e.target.value }))} style={inputStyle}>
            <option value="standard">Standard</option>
            <option value="eli5">ELI5 (Ultra-detailed)</option>
          </select>
        </div>
        <div><label style={labelStyle}>Weekly Hours</label><input type="number" step="0.5" min="0.5" max="40" value={form.weeklyHours} onChange={e => setForm(f => ({ ...f, weeklyHours: e.target.value }))} style={inputStyle} placeholder="e.g. 5" /></div>
        <div><label style={labelStyle}>Deadline</label><input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} /></div>
      </div>
      <div><label style={labelStyle}>Evidence of Mastery</label><input value={form.evidenceOfMastery} onChange={e => setForm(f => ({ ...f, evidenceOfMastery: e.target.value }))} style={inputStyle} /></div>
      <div><label style={labelStyle}>Final Output</label><input value={form.finalOutput} onChange={e => setForm(f => ({ ...f, finalOutput: e.target.value }))} style={inputStyle} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)', color: '#BF5AF2', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={() => setEditing(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
