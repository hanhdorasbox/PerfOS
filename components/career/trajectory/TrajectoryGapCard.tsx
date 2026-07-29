'use client'

import type { TrajectoryGap } from '@prisma/client'
import InsightCard from '@/components/ui/InsightCard'
import { sevColor, priorityToLevel } from '@/lib/insight/severity'

export interface ActionStep {
  step: number
  action: string
  timeframe: string
  output: string
}

export type GapLocal = TrajectoryGap & { _whyItMatters?: string }

const GAP_COLORS: Record<string, string> = {
  skill: '#61adff',
  proof_of_work: '#64f0aa',
  scope: '#ffce53',
  visibility: '#a085ff',
  experience: '#ffa360',
}
const DIFF_COLORS: Record<string, string> = { easy: '#64f0aa', medium: '#ffce53', hard: '#ff8168' }
export const GAP_LABELS: Record<string, string> = {
  skill: 'Skill',
  proof_of_work: 'Proof of Work',
  scope: 'Scope',
  visibility: 'Visibility',
  experience: 'Experience',
}

export function gapTag(gapType: string): string {
  return GAP_LABELS[gapType] ?? gapType.replace(/_/g, ' ')
}

interface Props {
  gap: GapLocal
  addedGapSteps: Record<string, Set<number>>
  addingAllGap: string | null
  addedNextAction: Set<string>
  generatingActionPlan: string | null
  deletingGap: string | null
  onGenerate: (gapId: string) => void
  onAddStep: (gapId: string, stepIndex: number, stepTitle: string) => void
  onAddAll: (gapId: string, steps: ActionStep[]) => void
  onAddNext: (gapId: string, action: string) => void
  onClose: (gapId: string) => void
  onArchive: (gapId: string) => void
  onDelete: (gapId: string) => void
}

export default function TrajectoryGapCard({
  gap,
  addedGapSteps,
  addingAllGap,
  addedNextAction,
  generatingActionPlan,
  deletingGap,
  onGenerate,
  onAddStep,
  onAddAll,
  onAddNext,
  onClose,
  onArchive,
  onDelete,
}: Props) {
  const color = GAP_COLORS[gap.gapType] ?? '#6E6E73'
  const isGenerating = generatingActionPlan === gap.id
  const isDeleting = deletingGap === gap.id
  const hasActionPlan = !!gap.actionPlan
  let steps: ActionStep[] = []
  if (gap.actionPlan) {
    try {
      steps = JSON.parse(gap.actionPlan)
    } catch {
      steps = []
    }
  }

  const sevLabel = gap.priority <= 1 ? 'High' : gap.priority === 2 ? 'Med' : 'Low'

  // "Why it matters": description reformatted into ≤3 bullets + the enrichment.
  const descBullets = gap.description
    ? gap.description.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : []
  const leftItems = [...descBullets]
  if (gap._whyItMatters) leftItems.push(gap._whyItMatters)
  if (leftItems.length === 0) leftItems.push('No description provided.')

  const bodyExtra =
    gap.difficulty || gap.weekEstimate || gap.evidenceNeeded ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11 }}>
        {gap.difficulty && (
          <span style={{ color: DIFF_COLORS[gap.difficulty] ?? '#6E6E73', fontWeight: 700 }}>{gap.difficulty}</span>
        )}
        {gap.weekEstimate && <span style={{ color: 'var(--text-muted)' }}>~{gap.weekEstimate}w</span>}
        {gap.evidenceNeeded && (
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Done when: </span>
            {gap.evidenceNeeded}
          </span>
        )}
      </div>
    ) : undefined

  const rightContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {gap.nextBestAction && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#64f0aa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Next action
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: 12 }}>{gap.nextBestAction}</p>
          </div>
          <button
            onClick={() => onAddNext(gap.id, gap.nextBestAction!)}
            disabled={addedNextAction.has(gap.id)}
            style={{
              flexShrink: 0,
              background: addedNextAction.has(gap.id) ? 'rgba(100, 240, 170,0.15)' : 'rgba(100, 240, 170,0.1)',
              border: '1px solid rgba(100, 240, 170,0.3)', color: '#64f0aa', borderRadius: 5, padding: '3px 9px',
              fontSize: 10, fontWeight: 600, cursor: addedNextAction.has(gap.id) ? 'default' : 'pointer',
            }}
          >
            {addedNextAction.has(gap.id) ? '✓ Added' : '+ Week'}
          </button>
        </div>
      )}

      {!hasActionPlan && (
        <button
          onClick={() => onGenerate(gap.id)}
          disabled={isGenerating}
          style={{
            alignSelf: 'flex-start',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            border: '1px solid var(--accent-border)', color: 'var(--accent)',
            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? 'Generating…' : 'Generate action plan'}
        </button>
      )}

      {hasActionPlan && steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {steps.length} steps
            </span>
            <button
              onClick={() => onAddAll(gap.id, steps)}
              disabled={addingAllGap === gap.id || (addedGapSteps[gap.id]?.size ?? 0) >= steps.length}
              style={{
                background: 'color-mix(in srgb, var(--accent) 16%, transparent)', border: '1px solid var(--accent-border)',
                color: 'var(--accent)', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700,
                cursor: addingAllGap === gap.id ? 'wait' : 'pointer',
              }}
            >
              {addingAllGap === gap.id
                ? '…'
                : (addedGapSteps[gap.id]?.size ?? 0) >= steps.length
                ? `✓ All ${steps.length} added`
                : `+ Add all ${steps.length} to week`}
            </button>
          </div>
          {steps.map((step, i) => {
            const isAdded = addedGapSteps[gap.id]?.has(i) ?? false
            return (
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
                    <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{step.action}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{step.timeframe}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→ {step.output}</span>
                </div>
                <button
                  onClick={() => onAddStep(gap.id, i, step.action)}
                  disabled={isAdded}
                  title="Add to this week"
                  style={{
                    flexShrink: 0,
                    background: isAdded ? 'rgba(100, 240, 170,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isAdded ? 'rgba(100, 240, 170,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    color: isAdded ? '#64f0aa' : 'var(--text-muted)', borderRadius: 5, padding: '3px 8px',
                    fontSize: 10, fontWeight: 600, cursor: isAdded ? 'default' : 'pointer',
                  }}
                >
                  {isAdded ? '✓ Added' : '+ Week'}
                </button>
              </div>
            )
          })}
          <button
            onClick={() => onGenerate(gap.id)}
            disabled={isGenerating}
            style={{
              alignSelf: 'flex-start', background: 'none', border: '1px solid var(--accent-border)',
              color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 6, fontSize: 11,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {isGenerating ? '⏳ Regenerating…' : '↻ Regenerate'}
          </button>
        </div>
      )}
    </div>
  )

  const actions = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button
        onClick={() => onClose(gap.id)}
        style={{
          background: 'rgba(100, 240, 170,0.1)', border: '1px solid rgba(100, 240, 170,0.25)',
          color: '#64f0aa', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ✓ Mark Closed
      </button>
      <button
        onClick={() => onArchive(gap.id)}
        style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-muted)', padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
        }}
      >
        Archive
      </button>
      <button
        onClick={() => onDelete(gap.id)}
        disabled={isDeleting}
        style={{
          background: 'none', border: '1px solid rgba(255, 129, 104,0.2)', color: '#ff8168',
          padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: isDeleting ? 'not-allowed' : 'pointer',
        }}
      >
        {isDeleting ? '…' : 'Delete'}
      </button>
    </div>
  )

  return (
    <InsightCard
      severityColor={sevColor(priorityToLevel(gap.priority))}
      severityLabel={sevLabel}
      dots={{ filled: gap.priority <= 1 ? 3 : gap.priority === 2 ? 2 : 1, total: 3 }}
      title={gap.title}
      domainTag={gapTag(gap.gapType)}
      leftLabel="Why it matters"
      leftItems={leftItems}
      rightLabel="How to Close"
      rightContent={rightContent}
      bodyExtra={bodyExtra}
      actions={actions}
    />
  )
}
