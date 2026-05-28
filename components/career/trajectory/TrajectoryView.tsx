'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CareerTrajectory, TrajectoryGap, TrajectoryQuarterPlan } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionStep {
  step: number
  action: string
  timeframe: string
  output: string
}

interface RoadmapPhase {
  phase: string
  monthRange: string
  focus: string
  milestones: string[]
  keyOutput: string
  gapsClosed?: string[]
}

interface SuggestedProject {
  title: string
  why: string
  gaps: string[]
  effort: string
  impact: string
}

// Gap with client-side enrichment (whyItMatters from action-plan response)
interface GapLocal extends TrajectoryGap {
  _whyItMatters?: string
  _expanded?: boolean
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const GAP_COLORS: Record<string, string> = {
  skill: '#0A84FF',
  proof_of_work: '#30D158',
  scope: '#FFD60A',
  visibility: '#BF5AF2',
  experience: '#FF9F0A',
}

const DIFF_COLORS: Record<string, string> = {
  easy: '#30D158',
  medium: '#FFD60A',
  hard: '#FF453A',
}

function gapColor(type: string) { return GAP_COLORS[type] ?? '#6E6E73' }

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 70 ? '#30D158' : score >= 40 ? '#FFD60A' : '#FF453A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'right' }}>{score}%</span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  trajectory: CareerTrajectory & {
    gaps: TrajectoryGap[]
    quarterlyPlans: TrajectoryQuarterPlan[]
  }
  quarterId: string | null
  userId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrajectoryView({ trajectory, quarterId }: Props) {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────

  const [gaps, setGaps] = useState<GapLocal[]>(trajectory.gaps)
  const [plans, setPlans] = useState(trajectory.quarterlyPlans)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false)
  const [generatingActionPlan, setGeneratingActionPlan] = useState<string | null>(null)  // gap id
  const [deletingGap, setDeletingGap] = useState<string | null>(null)
  const [deletingTrajectory, setDeletingTrajectory] = useState(false)
  const [error, setError] = useState('')

  // Local trajectory meta (readiness, roadmap)
  const [readinessScore, setReadinessScore] = useState<number | null>(
    typeof trajectory.readinessScore === 'number' ? trajectory.readinessScore : null
  )
  const [readinessBreakdown, setReadinessBreakdown] = useState<Record<string, number> | null>(
    trajectory.readinessBreakdown ? (() => { try { return JSON.parse(trajectory.readinessBreakdown!) } catch { return null } })() : null
  )
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>(
    trajectory.executionRoadmap ? (() => { try { return JSON.parse(trajectory.executionRoadmap!) } catch { return [] } })() : []
  )
  const [suggestedProjects, setSuggestedProjects] = useState<SuggestedProject[]>([])
  const [trajectoryNextAction, setTrajectoryNextAction] = useState<string | null>(
    trajectory.nextBestAction ?? null
  )

  // Gap expansion state
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set())
  const [showClosed, setShowClosed] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(roadmap.length > 0)

  // ── Derived ────────────────────────────────────────────────────────────────

  const openGaps = gaps.filter(g => !g.closed && !g.archived)
  const closedGaps = gaps.filter(g => g.closed && !g.archived)
  const archivedGaps = gaps.filter(g => g.archived)

  const gapsByType = openGaps.reduce((acc, g) => {
    if (!acc[g.gapType]) acc[g.gapType] = []
    acc[g.gapType].push(g)
    return acc
  }, {} as Record<string, GapLocal[]>)

  const latestPlan = plans[0]

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showError(msg: string) {
    setError(msg)
    setTimeout(() => setError(''), 5000)
  }

  function toggleExpand(gapId: string) {
    setExpandedGaps(prev => {
      const next = new Set(prev)
      if (next.has(gapId)) next.delete(gapId)
      else next.add(gapId)
      return next
    })
  }

  // ── Actions ────────────────────────────────────────────────────────────────

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

  async function reopenGap(gapId: string) {
    const res = await fetch(`/api/career/trajectory/gaps/${gapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: false }),
    })
    if (res.ok) {
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, closed: false, closedAt: null } : g))
    }
  }

  async function archiveGap(gapId: string) {
    const res = await fetch(`/api/career/trajectory/gaps/${gapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    if (res.ok) {
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, archived: true, archivedAt: new Date() } : g))
    }
  }

  async function unarchiveGap(gapId: string) {
    const res = await fetch(`/api/career/trajectory/gaps/${gapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    })
    if (res.ok) {
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, archived: false, archivedAt: null } : g))
    }
  }

  async function deleteGap(gapId: string) {
    if (!confirm('Delete this gap permanently?')) return
    setDeletingGap(gapId)
    try {
      const res = await fetch(`/api/career/trajectory/gaps/${gapId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setGaps(prev => prev.filter(g => g.id !== gapId))
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingGap(null) }
  }

  async function generateActionPlan(gapId: string) {
    setGeneratingActionPlan(gapId)
    try {
      const res = await fetch(`/api/career/trajectory/gaps/${gapId}/action-plan`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setGaps(prev => prev.map(g => g.id === gapId ? {
        ...g,
        actionPlan: data.gap.actionPlan,
        nextBestAction: data.gap.nextBestAction,
        evidenceNeeded: data.gap.evidenceNeeded,
        difficulty: data.gap.difficulty,
        weekEstimate: data.gap.weekEstimate,
        _whyItMatters: data.whyItMatters,
      } : g))
      setExpandedGaps(prev => new Set([...prev, gapId]))
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error generating action plan')
    } finally {
      setGeneratingActionPlan(null)
    }
  }

  async function generateRoadmap() {
    setGeneratingRoadmap(true)
    setError('')
    try {
      const res = await fetch(`/api/career/trajectory/${trajectory.id}/roadmap`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReadinessScore(data.readinessScore ?? null)
      setReadinessBreakdown(data.readinessBreakdown ?? null)
      setRoadmap(data.roadmap ?? [])
      setSuggestedProjects(data.suggestedProjects ?? [])
      setTrajectoryNextAction(data.nextBestAction ?? null)
      setShowRoadmap(true)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error generating roadmap')
    } finally {
      setGeneratingRoadmap(false)
    }
  }

  async function generateQuarterPlan() {
    if (!quarterId) { showError('No active quarter found'); return }
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
      showError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGeneratingPlan(false)
    }
  }

  async function deleteTrajectory() {
    if (!confirm('Delete this entire career trajectory and all gaps? This cannot be undone.')) return
    setDeletingTrajectory(true)
    try {
      const res = await fetch(`/api/career/trajectory/${trajectory.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Delete failed')
      setDeletingTrajectory(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {error && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF453A', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ─── Top action bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={deleteTrajectory}
          disabled={deletingTrajectory}
          style={{
            background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#FF453A', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: deletingTrajectory ? 'not-allowed' : 'pointer',
          }}
        >
          {deletingTrajectory ? '⏳ Deleting...' : '🗑 Delete Trajectory'}
        </button>
      </div>

      {/* ─── Section A: Target + Readiness Score ─────────────────────────── */}
      <div className="card" style={{ background: 'rgba(180,167,229,0.07)', border: '1px solid rgba(180,167,229,0.18)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Target Role</p>
            <p style={{ color: '#F5F5F7', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
              {trajectory.targetRoleTitle || trajectory.targetPath.replace(/_/g, ' ')}
            </p>
            <p style={{ color: '#A1A1A6', fontSize: 13, marginTop: 3 }}>
              from <span style={{ color: '#F5F5F7' }}>{trajectory.currentRole}</span>
              {trajectory.timeHorizon && <> · <span style={{ color: '#BF5AF2' }}>{trajectory.timeHorizon}</span></>}
            </p>
          </div>
          <div style={{ textAlign: 'right', minWidth: 80 }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Open gaps</p>
            <p style={{ color: '#FFD60A', fontSize: 22, fontWeight: 700 }}>{openGaps.length}</p>
            <p style={{ color: '#30D158', fontSize: 12, marginTop: 1 }}>{closedGaps.length} closed</p>
          </div>
        </div>

        {/* Readiness score */}
        {readinessScore !== null && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ color: '#A1A1A6', fontSize: 12, fontWeight: 600 }}>Readiness Score</p>
              <button
                onClick={generateRoadmap}
                disabled={generatingRoadmap}
                style={{ background: 'none', border: '1px solid rgba(180,167,229,0.3)', color: '#BF5AF2', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: generatingRoadmap ? 'not-allowed' : 'pointer' }}
              >
                {generatingRoadmap ? '⏳ Updating...' : '↻ Recalculate'}
              </button>
            </div>
            <ReadinessBar score={readinessScore} />
            {readinessBreakdown && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {Object.entries(readinessBreakdown).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ color: gapColor(key), fontSize: 11, fontWeight: 700 }}>{val}%</span>
                    <span style={{ color: '#6E6E73', fontSize: 10, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next Best Action (trajectory-level) */}
        {trajectoryNextAction && (
          <div style={{ marginTop: 12, background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ color: '#30D158', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Next Best Action</p>
            <p style={{ color: '#F5F5F7', fontSize: 13 }}>{trajectoryNextAction}</p>
          </div>
        )}

        {/* Generate readiness button if not yet generated */}
        {readinessScore === null && (
          <button
            onClick={generateRoadmap}
            disabled={generatingRoadmap}
            style={{
              marginTop: 14, width: '100%', background: 'rgba(180,167,229,0.12)', border: '1px solid rgba(180,167,229,0.35)',
              color: '#BF5AF2', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: generatingRoadmap ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingRoadmap ? '⏳ Calculating readiness...' : '⚡ Generate Readiness Score + Roadmap'}
          </button>
        )}

      </div>

      {/* ─── Section B: Gap Cards ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 16 }}>Gap Execution Plan</h3>

        {openGaps.length === 0 ? (
          <p style={{ color: '#30D158', fontSize: 14 }}>All gaps closed — ready to define the next horizon.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {openGaps.map(gap => {
              const color = gapColor(gap.gapType)
              const isExpanded = expandedGaps.has(gap.id)
              const isGenerating = generatingActionPlan === gap.id
              const isDeleting = deletingGap === gap.id
              const hasActionPlan = !!gap.actionPlan
              let steps: ActionStep[] = []
              if (gap.actionPlan) {
                try { steps = JSON.parse(gap.actionPlan) } catch { steps = [] }
              }

              return (
                <div
                  key={gap.id}
                  style={{
                    border: `1px solid ${color}25`,
                    borderRadius: 12,
                    background: `${color}07`,
                    opacity: isDeleting ? 0.4 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* Gap header — always visible */}
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        {/* Type chip + priority + difficulty */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 7 }}>
                          <span style={{
                            background: `${color}20`, color, border: `1px solid ${color}40`,
                            padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          }}>
                            {gap.gapType.replace(/_/g, ' ')}
                          </span>
                          <span style={{
                            color: gap.priority === 1 ? '#FF453A' : gap.priority === 2 ? '#FFD60A' : '#6E6E73',
                            fontSize: 10, fontWeight: 700,
                          }}>
                            {gap.priority === 1 ? '🔴 High' : gap.priority === 2 ? '🟡 Med' : '🟢 Low'}
                          </span>
                          {gap.difficulty && (
                            <span style={{ color: DIFF_COLORS[gap.difficulty] ?? '#6E6E73', fontSize: 10, fontWeight: 700 }}>
                              {gap.difficulty}
                            </span>
                          )}
                          {gap.weekEstimate && (
                            <span style={{ color: '#6E6E73', fontSize: 10 }}>~{gap.weekEstimate}w</span>
                          )}
                        </div>

                        <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{gap.title}</p>
                        {gap.description && (
                          <p style={{ color: '#6E6E73', fontSize: 12, lineHeight: 1.5 }}>{gap.description}</p>
                        )}
                        {gap._whyItMatters && (
                          <p style={{ color: '#BF5AF2', fontSize: 12, marginTop: 5, fontStyle: 'italic' }}>{gap._whyItMatters}</p>
                        )}
                      </div>
                    </div>

                    {/* Next best action — always visible if exists */}
                    {gap.nextBestAction && (
                      <div style={{ background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 8, padding: '7px 11px', marginTop: 8 }}>
                        <p style={{ color: '#30D158', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Next Action</p>
                        <p style={{ color: '#F5F5F7', fontSize: 12 }}>{gap.nextBestAction}</p>
                      </div>
                    )}

                    {/* Evidence needed */}
                    {gap.evidenceNeeded && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ color: '#6E6E73', fontSize: 11 }}>
                          <span style={{ color: '#A1A1A6', fontWeight: 600 }}>Done when: </span>{gap.evidenceNeeded}
                        </span>
                      </div>
                    )}

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      {!hasActionPlan && (
                        <button
                          onClick={() => generateActionPlan(gap.id)}
                          disabled={isGenerating}
                          style={{
                            background: `${color}15`, border: `1px solid ${color}40`, color,
                            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isGenerating ? '⏳ Generating...' : '⚡ How to Close'}
                        </button>
                      )}
                      {hasActionPlan && (
                        <button
                          onClick={() => toggleExpand(gap.id)}
                          style={{
                            background: `${color}15`, border: `1px solid ${color}40`, color,
                            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {isExpanded ? '▲ Hide Plan' : '▼ View Plan'}
                        </button>
                      )}
                      <button
                        onClick={() => closeGap(gap.id)}
                        style={{
                          background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.25)',
                          color: '#30D158', padding: '5px 12px', borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✓ Mark Closed
                      </button>
                      <button
                        onClick={() => archiveGap(gap.id)}
                        style={{
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                          color: '#6E6E73', padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => deleteGap(gap.id)}
                        disabled={isDeleting}
                        style={{
                          background: 'none', border: '1px solid rgba(255,107,107,0.2)',
                          color: '#FF453A', padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        {isDeleting ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable: Action Plan steps */}
                  {isExpanded && steps.length > 0 && (
                    <div style={{ borderTop: `1px solid ${color}20`, padding: '12px 14px' }}>
                      <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Action Plan — {steps.length} steps
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {steps.map((step, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: `${color}20`, border: `1px solid ${color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color, fontSize: 10, fontWeight: 700,
                            }}>
                              {step.step}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                                <span style={{ color: '#F5F5F7', fontSize: 13 }}>{step.action}</span>
                                <span style={{ color: '#6E6E73', fontSize: 11 }}>{step.timeframe}</span>
                              </div>
                              <span style={{ color: '#6E6E73', fontSize: 11 }}>→ {step.output}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => generateActionPlan(gap.id)}
                          disabled={isGenerating}
                          style={{
                            background: 'none', border: `1px solid ${color}30`, color: '#6E6E73',
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: isGenerating ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isGenerating ? '⏳ Regenerating...' : '↻ Regenerate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Section C: Execution Roadmap ─────────────────────────────────── */}
      {(roadmap.length > 0 || generatingRoadmap) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7' }}>Execution Roadmap</h3>
            <button
              onClick={() => setShowRoadmap(v => !v)}
              style={{ background: 'none', border: 'none', color: '#6E6E73', fontSize: 12, cursor: 'pointer' }}
            >
              {showRoadmap ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>

          {showRoadmap && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roadmap.map((phase, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#BF5AF2', fontSize: 12, fontWeight: 700 }}>{phase.phase}</span>
                      <span style={{ color: '#6E6E73', fontSize: 11 }}>{phase.monthRange}</span>
                    </div>
                  </div>
                  <p style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{phase.focus}</p>
                  {phase.milestones?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                      {phase.milestones.map((m, j) => (
                        <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <span style={{ color: '#BF5AF2', fontSize: 11, marginTop: 1 }}>·</span>
                          <span style={{ color: '#A1A1A6', fontSize: 12 }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ background: 'rgba(107,227,164,0.07)', borderRadius: 7, padding: '6px 10px' }}>
                    <span style={{ color: '#30D158', fontSize: 11, fontWeight: 600 }}>Output: </span>
                    <span style={{ color: '#F5F5F7', fontSize: 12 }}>{phase.keyOutput}</span>
                  </div>
                  {phase.gapsClosed && phase.gapsClosed.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {phase.gapsClosed.map((g, j) => (
                        <span key={j} style={{ color: '#6E6E73', fontSize: 10, background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)' }}>
                          closes: {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Section D: Suggested Projects ───────────────────────────────── */}
      {suggestedProjects.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 14 }}>Suggested Projects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestedProjects.map((p, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <p style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{p.title}</p>
                  <span style={{ color: '#6E6E73', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>{p.effort}</span>
                </div>
                <p style={{ color: '#A1A1A6', fontSize: 12, marginBottom: 6 }}>{p.why}</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {p.gaps?.map((g, j) => (
                    <span key={j} style={{
                      background: `${gapColor(g)}15`, color: gapColor(g), border: `1px solid ${gapColor(g)}30`,
                      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {g.replace(/_/g, ' ')}
                    </span>
                  ))}
                  <span style={{ color: '#30D158', fontSize: 11 }}>→ {p.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section E: Quarter Plan ──────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7' }}>Quarterly Focus</h3>
          <button
            onClick={generateQuarterPlan}
            disabled={generatingPlan}
            style={{
              background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
              color: '#BF5AF2', padding: '7px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: generatingPlan ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingPlan ? '⏳ Generating...' : '+ Generate Quarter Plan'}
          </button>
        </div>

        {!latestPlan ? (
          <p style={{ color: '#6E6E73', fontSize: 14 }}>No quarter plan yet. Generate one to get AI-recommended priorities.</p>
        ) : (
          <div>
            {latestPlan.priorities && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Priorities</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {((() => { try { return JSON.parse(latestPlan.priorities!) as string[] } catch { return [] } })()).map((p: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#BF5AF2', fontWeight: 700, fontSize: 13 }}>{i + 1}.</span>
                      <span style={{ color: '#F5F5F7', fontSize: 13 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latestPlan.keyOutput && (
              <div style={{ background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                <p style={{ color: '#30D158', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Key Output</p>
                <p style={{ color: '#F5F5F7', fontSize: 13 }}>{latestPlan.keyOutput}</p>
              </div>
            )}
            {latestPlan.highUpsideBet && (
              <div style={{ background: 'rgba(242,192,99,0.08)', border: '1px solid rgba(242,192,99,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ color: '#FFD60A', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>High-Upside Bet ⭐</p>
                <p style={{ color: '#F5F5F7', fontSize: 13 }}>{latestPlan.highUpsideBet}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Section F: Closed Gaps ───────────────────────────────────────── */}
      {closedGaps.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowClosed(v => !v)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#30D158' }}>✓ Closed Gaps ({closedGaps.length})</h3>
            <span style={{ color: '#6E6E73', fontSize: 12 }}>{showClosed ? '▲' : '▼'}</span>
          </button>
          {showClosed && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closedGaps.map(gap => (
                <div key={gap.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'rgba(107,227,164,0.05)',
                  border: '1px solid rgba(107,227,164,0.15)', borderRadius: 8,
                }}>
                  <div>
                    <span style={{ color: '#30D158', fontSize: 12, fontWeight: 600 }}>{gap.title}</span>
                    <span style={{ color: '#6E6E73', fontSize: 11, marginLeft: 8 }}>
                      {gap.gapType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => reopenGap(gap.id)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Archived gaps ────────────────────────────────────────────────── */}
      {archivedGaps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowArchived(v => !v)}
            style={{ background: 'none', border: 'none', color: '#6E6E73', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            {showArchived ? '▲' : '▼'} Archived gaps ({archivedGaps.length})
          </button>
          {showArchived && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {archivedGaps.map(gap => (
                <div key={gap.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                  <span style={{ color: '#6E6E73', fontSize: 12 }}>{gap.title}</span>
                  <button
                    onClick={() => unarchiveGap(gap.id)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Unarchive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
