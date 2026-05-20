'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Idea } from '@prisma/client'

const domainColors: Record<string, string> = {
  work_improvement: '#60A5FA',
  automation: '#B4A7E5',
  product: '#6BE3A4',
  content: '#F2C063',
  research: '#FB923C',
  project: '#FF6B6B',
  other: '#76746E',
}

const effortColors: Record<string, string> = {
  low: '#6BE3A4',
  medium: '#F2C063',
  high: '#FF6B6B',
}

const STATUS_TRANSITIONS: Record<string, { label: string; nextStatus: string }> = {
  inbox: { label: 'Worth Exploring →', nextStatus: 'worth_exploring' },
  worth_exploring: { label: 'Convert to Goal →', nextStatus: 'convert_to_goal' },
  convert_to_goal: { label: 'Archive', nextStatus: 'archived' },
  hold: { label: 'Back to Inbox', nextStatus: 'inbox' },
}

interface EvalData {
  isStrategicRelevant: boolean
  timing: string
  upside: string
  recommendation: string
  smallestNextStep: string
  whatMustBeTrue: string
}

export default function IdeaCard({ idea }: { idea: Idea }) {
  const router = useRouter()
  const [showEval, setShowEval] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')

  const evalData: EvalData | null = idea.aiEvaluation ? (() => {
    try { return JSON.parse(idea.aiEvaluation!) } catch { return null }
  })() : null

  async function advanceStatus() {
    const transition = STATUS_TRANSITIONS[idea.status]
    if (!transition) return
    await fetch(`/api/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: transition.nextStatus }),
    })
    router.refresh()
  }

  async function moveToHold() {
    await fetch(`/api/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'hold' }),
    })
    router.refresh()
  }

  async function evaluate() {
    setEvaluating(true)
    setError('')
    try {
      const res = await fetch(`/api/ideas/${idea.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id }),
      })
      if (!res.ok) throw new Error('Evaluation failed')
      setShowEval(true)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEvaluating(false)
    }
  }

  const transition = STATUS_TRANSITIONS[idea.status]
  const domainColor = domainColors[idea.domain ?? 'other'] ?? '#76746E'

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 8 }}>
            {idea.isTimeSensitive && '⏰ '}
            {idea.isHighUpsideBet && '⭐ '}
            {idea.title}
          </p>
        </div>

        {idea.description && (
          <p style={{ color: '#B8B6B0', fontSize: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {idea.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {idea.domain && (
          <span style={{
            background: `${domainColor}20`, color: domainColor,
            border: `1px solid ${domainColor}40`,
            padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          }}>
            {idea.domain.replace(/_/g, ' ')}
          </span>
        )}
        {idea.effortEstimate && (
          <span style={{
            background: `${effortColors[idea.effortEstimate] ?? '#76746E'}15`,
            color: effortColors[idea.effortEstimate] ?? '#76746E',
            border: `1px solid ${effortColors[idea.effortEstimate] ?? '#76746E'}30`,
            padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          }}>
            {idea.effortEstimate} effort
          </span>
        )}
      </div>

      {idea.nextStep && (
        <p style={{ color: '#B4A7E5', fontSize: 11, marginBottom: 8 }}>
          → {idea.nextStep}
        </p>
      )}

      {evalData && showEval && (
        <div style={{
          background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.15)',
          borderRadius: 8, padding: '8px 10px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: evalData.isStrategicRelevant ? '#6BE3A4' : '#FF6B6B', fontSize: 11, fontWeight: 700 }}>
              {evalData.isStrategicRelevant ? '✓ Strategic' : '✗ Not strategic'}
            </span>
            <span style={{ color: '#76746E', fontSize: 11 }}>Timing: {evalData.timing}</span>
          </div>
          <p style={{ color: '#FAFAFA', fontSize: 12, marginBottom: 4 }}>{evalData.recommendation}</p>
          <p style={{ color: '#B8B6B0', fontSize: 11 }}>Next step: {evalData.smallestNextStep}</p>
        </div>
      )}

      {evalData && !showEval && (
        <button
          onClick={() => setShowEval(true)}
          style={{ background: 'none', border: 'none', color: '#B4A7E5', fontSize: 11, cursor: 'pointer', padding: '0 0 8px 0', display: 'block' }}
        >
          Show AI evaluation ▼
        </button>
      )}

      {error && <p style={{ color: '#FF6B6B', fontSize: 11, marginBottom: 6 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {!idea.aiEvaluation && (
          <button
            onClick={evaluate}
            disabled={evaluating}
            style={{
              background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.25)',
              color: '#B4A7E5', padding: '4px 8px', borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: evaluating ? 'not-allowed' : 'pointer',
            }}
          >
            {evaluating ? '⏳' : '🤖 Evaluate'}
          </button>
        )}
        {transition && (
          <button
            onClick={advanceStatus}
            style={{
              background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)',
              color: '#6BE3A4', padding: '4px 8px', borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {transition.label}
          </button>
        )}
        {idea.status !== 'hold' && idea.status !== 'archived' && (
          <button
            onClick={moveToHold}
            style={{
              background: 'rgba(118,116,110,0.1)', border: '1px solid rgba(118,116,110,0.2)',
              color: '#76746E', padding: '4px 8px', borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Hold
          </button>
        )}
      </div>
    </div>
  )
}
