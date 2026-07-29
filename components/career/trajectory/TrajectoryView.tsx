'use client'
import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { CareerTrajectory, TrajectoryGap, TrajectoryQuarterPlan } from '@prisma/client'
import InsightCardList from '@/components/ui/InsightCardList'
import TrajectoryGapCard, { gapTag } from './TrajectoryGapCard'

// Point the shared insight components' accent CSS vars at the Career purple.
const PURPLE_ACCENT: CSSProperties = {
  '--accent': 'var(--purple-text)',
  '--accent-soft': 'var(--purple-bg)',
  '--accent-border': 'var(--purple-border)',
  '--accent-glow': 'var(--purple-glow)',
} as CSSProperties

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
  skill: '#61adff',
  proof_of_work: '#64f0aa',
  scope: '#ffce53',
  visibility: '#a085ff',
  experience: '#ffa360',
}

function gapColor(type: string) { return GAP_COLORS[type] ?? '#6E6E73' }

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 70 ? '#64f0aa' : score >= 40 ? '#ffce53' : '#ff8168'
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

export default function TrajectoryView({ trajectory, quarterId, userId }: Props) {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────

  const [gaps, setGaps] = useState<GapLocal[]>(trajectory.gaps)
  // Track which step indices per gap have been added to the week plan
  const [addedGapSteps, setAddedGapSteps] = useState<Record<string, Set<number>>>({})
  // Track bulk "add all" loading state per gap
  const [addingAllGap, setAddingAllGap] = useState<string | null>(null)
  // Track nextBestAction added per gap
  const [addedNextAction, setAddedNextAction] = useState<Set<string>>(new Set())
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

  const [showClosed, setShowClosed] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(roadmap.length > 0)

  // ── Add gap step to week plan ──────────────────────────────────────────────

  async function addGapStepToWeek(gapId: string, stepIndex: number, stepTitle: string) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: stepTitle,
          effort: 2,
          priority: 2,
          taskType: 'other',
          sourceModule: 'career_gap',
          sourceId: gapId,
          createdBy: 'user',
        }),
      })
      if (res.ok) {
        setAddedGapSteps(prev => {
          const next = { ...prev }
          next[gapId] = new Set([...(prev[gapId] ?? []), stepIndex])
          return next
        })
      }
    } catch { /* silent */ }
  }

  // Add ALL steps of a gap's action plan to this week at once
  async function addAllGapStepsToWeek(gapId: string, steps: ActionStep[]) {
    if (!steps.length) return
    setAddingAllGap(gapId)
    try {
      const res = await fetch(`/api/career/trajectory/gaps/${gapId}/add-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tasks: steps.map((s, i) => ({ title: s.action, timeframe: s.timeframe, output: s.output, priority: i < 2 ? 1 : 2 })),
        }),
      })
      if (res.ok) {
        setAddedGapSteps(prev => ({
          ...prev,
          [gapId]: new Set(steps.map((_, i) => i)),
        }))
      }
    } catch { /* silent */ } finally { setAddingAllGap(null) }
  }

  // Add gap's nextBestAction as a single task
  async function addNextActionToWeek(gapId: string, action: string) {
    try {
      const res = await fetch(`/api/career/trajectory/gaps/${gapId}/add-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tasks: [{ title: action, priority: 1 }] }),
      })
      if (res.ok) setAddedNextAction(prev => new Set(prev).add(gapId))
    } catch { /* silent */ }
  }

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
        <div style={{ background: 'rgba(255, 129, 104,0.1)', border: '1px solid rgba(255, 129, 104,0.2)', color: '#ff8168', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ─── Top action bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={deleteTrajectory}
          disabled={deletingTrajectory}
          style={{
            background: 'rgba(255, 129, 104,0.08)', border: '1px solid rgba(255, 129, 104,0.3)',
            color: '#ff8168', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: deletingTrajectory ? 'not-allowed' : 'pointer',
          }}
        >
          {deletingTrajectory ? 'Deleting...' : 'Delete Trajectory'}
        </button>
      </div>

      {/* ─── Section A: Target + Readiness Score ─────────────────────────── */}
      <div className="card" style={{ background: 'rgba(160, 133, 255,0.07)', border: '1px solid rgba(160, 133, 255,0.18)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Target Role</p>
            <p style={{ color: '#F5F5F7', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
              {trajectory.targetRoleTitle || trajectory.targetPath.replace(/_/g, ' ')}
            </p>
            <p style={{ color: '#A1A1A6', fontSize: 13, marginTop: 3 }}>
              from <span style={{ color: '#F5F5F7' }}>{trajectory.currentRole}</span>
              {trajectory.timeHorizon && <> · <span style={{ color: '#a085ff' }}>{trajectory.timeHorizon}</span></>}
            </p>
          </div>
          <div style={{ textAlign: 'right', minWidth: 80 }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Open gaps</p>
            <p style={{ color: '#ffce53', fontSize: 22, fontWeight: 700 }}>{openGaps.length}</p>
            <p style={{ color: '#64f0aa', fontSize: 12, marginTop: 1 }}>{closedGaps.length} closed</p>
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
                style={{ background: 'none', border: '1px solid rgba(160, 133, 255,0.3)', color: '#a085ff', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: generatingRoadmap ? 'not-allowed' : 'pointer' }}
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
          <div style={{ marginTop: 12, background: 'rgba(100, 240, 170,0.08)', border: '1px solid rgba(100, 240, 170,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ color: '#64f0aa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Next Best Action</p>
            <p style={{ color: '#F5F5F7', fontSize: 13 }}>{trajectoryNextAction}</p>
          </div>
        )}

        {/* Generate readiness button if not yet generated */}
        {readinessScore === null && (
          <button
            onClick={generateRoadmap}
            disabled={generatingRoadmap}
            style={{
              marginTop: 14, width: '100%', background: 'rgba(160, 133, 255,0.12)', border: '1px solid rgba(160, 133, 255,0.35)',
              color: '#a085ff', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: generatingRoadmap ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingRoadmap ? 'Calculating readiness...' : 'Generate Readiness Score + Roadmap'}
          </button>
        )}

      </div>

      {/* ─── Section B: Gap Cards ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 16 }}>Gap Execution Plan</h3>

        {openGaps.length === 0 ? (
          <p style={{ color: '#64f0aa', fontSize: 14 }}>All gaps closed — ready to define the next horizon.</p>
        ) : (
          <InsightCardList
            accentStyle={PURPLE_ACCENT}
            items={openGaps.map(gap => ({
              id: gap.id,
              tag: gapTag(gap.gapType),
              node: (
                <TrajectoryGapCard
                  gap={gap}
                  addedGapSteps={addedGapSteps}
                  addingAllGap={addingAllGap}
                  addedNextAction={addedNextAction}
                  generatingActionPlan={generatingActionPlan}
                  deletingGap={deletingGap}
                  onGenerate={generateActionPlan}
                  onAddStep={addGapStepToWeek}
                  onAddAll={addAllGapStepsToWeek}
                  onAddNext={addNextActionToWeek}
                  onClose={closeGap}
                  onArchive={archiveGap}
                  onDelete={deleteGap}
                />
              ),
            }))}
          />
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
                      <span style={{ color: '#a085ff', fontSize: 12, fontWeight: 700 }}>{phase.phase}</span>
                      <span style={{ color: '#6E6E73', fontSize: 11 }}>{phase.monthRange}</span>
                    </div>
                  </div>
                  <p style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{phase.focus}</p>
                  {phase.milestones?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                      {phase.milestones.map((m, j) => (
                        <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <span style={{ color: '#a085ff', fontSize: 11, marginTop: 1 }}>·</span>
                          <span style={{ color: '#A1A1A6', fontSize: 12 }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ background: 'rgba(100, 240, 170,0.07)', borderRadius: 7, padding: '6px 10px' }}>
                    <span style={{ color: '#64f0aa', fontSize: 11, fontWeight: 600 }}>Output: </span>
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
                  <span style={{ color: '#64f0aa', fontSize: 11 }}>→ {p.impact}</span>
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
              background: 'rgba(160, 133, 255,0.15)', border: '1px solid rgba(160, 133, 255,0.4)',
              color: '#a085ff', padding: '7px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: generatingPlan ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingPlan ? 'Generating...' : '+ Generate Quarter Plan'}
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
                      <span style={{ color: '#a085ff', fontWeight: 700, fontSize: 13 }}>{i + 1}.</span>
                      <span style={{ color: '#F5F5F7', fontSize: 13 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latestPlan.keyOutput && (
              <div style={{ background: 'rgba(100, 240, 170,0.08)', border: '1px solid rgba(100, 240, 170,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                <p style={{ color: '#64f0aa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Key Output</p>
                <p style={{ color: '#F5F5F7', fontSize: 13 }}>{latestPlan.keyOutput}</p>
              </div>
            )}
            {latestPlan.highUpsideBet && (
              <div style={{ background: 'rgba(255, 206, 83,0.08)', border: '1px solid rgba(255, 206, 83,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ color: '#ffce53', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>High-Upside Bet ⭐</p>
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
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#64f0aa' }}>✓ Closed Gaps ({closedGaps.length})</h3>
            <span style={{ color: '#6E6E73', fontSize: 12 }}>{showClosed ? '▲' : '▼'}</span>
          </button>
          {showClosed && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closedGaps.map(gap => (
                <div key={gap.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'rgba(100, 240, 170,0.05)',
                  border: '1px solid rgba(100, 240, 170,0.15)', borderRadius: 8,
                }}>
                  <div>
                    <span style={{ color: '#64f0aa', fontSize: 12, fontWeight: 600 }}>{gap.title}</span>
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
