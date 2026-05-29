'use client'

import { useState } from 'react'

type Skill = {
  id: string
  title: string
  category: string
  proficiency: number
  inUse: boolean
}

type ProofOfWork = {
  id: string
  title: string
  type: string
  reusability: number
  monetizable: boolean
}

type CareerCapitalEval = {
  increasesCapital: boolean
  howExactly?: string | null
  newAsset?: string | null
  reusabilityScore: number
  leveragePotential?: string | null
  proofAttached: boolean
} | null

type Goal = {
  id: string
  title: string
  category: string
  careerCapitalEval: CareerCapitalEval
}

type ScorecardData = {
  overallStatus: 'compounding' | 'maintaining' | 'declining'
  statusReason: string
  insights: { type: 'positive' | 'warning' | 'critical'; text: string }[]
  recommendations: { priority: 'high' | 'medium'; text: string }[]
  capabilitiesGained: number
  proofOfWorkCreated: number
  goalsWithCapitalImpact: number
  reusableAssets: number
}

function computeStatus(
  skills: Skill[],
  proofOfWork: ProofOfWork[],
  goals: Goal[]
): 'compounding' | 'maintaining' | 'declining' {
  const hasSkills = skills.length >= 2
  const hasHighReusability = proofOfWork.some(p => p.reusability >= 4)
  const goalsWithCapital = goals.filter(g => g.careerCapitalEval?.increasesCapital).length
  const majorityGoalsBuilding = goals.length > 0 && goalsWithCapital / goals.length > 0.5

  if (hasSkills && hasHighReusability && majorityGoalsBuilding) return 'compounding'
  if (skills.length === 0 && proofOfWork.length === 0) return 'declining'
  return 'maintaining'
}

const statusConfig = {
  compounding: { label: 'Compounding', color: '#7FD5AA', border: '3px solid #7FD5AA', bg: 'rgba(127,213,170,0.08)' },
  maintaining: { label: 'Maintaining', color: '#ECC666', border: '3px solid #F2C063', bg: 'rgba(236,198,102,0.08)' },
  declining: { label: 'Declining', color: '#FF9B87', border: '3px solid #FF9B87', bg: 'rgba(255,155,135,0.08)' },
}

const insightColors = {
  positive: '#7FD5AA',
  warning: '#ECC666',
  critical: '#FF9B87',
}

export default function CareerScorecard({
  skills,
  proofOfWork,
  goals,
  quarterName,
  userId,
}: {
  skills: Skill[]
  proofOfWork: ProofOfWork[]
  goals: Goal[]
  quarterName: string
  userId: string
}) {
  const [loading, setLoading] = useState(false)
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const status = computeStatus(skills, proofOfWork, goals)
  const cfg = statusConfig[status]

  const goalsWithCapital = goals.filter(g => g.careerCapitalEval?.increasesCapital).length
  const reusableAssets = proofOfWork.filter(p => p.reusability >= 4).length

  const chips = [
    { label: 'Skills Added', value: skills.length },
    { label: 'Proof-of-Work Assets', value: proofOfWork.length },
    { label: 'Goals Building Capital', value: `${goalsWithCapital}/${goals.length}` },
    { label: 'Reusable Assets', value: reusableAssets },
  ]

  async function generateScorecard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/career/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, quarterName }),
      })
      if (!res.ok) throw new Error('Failed to generate scorecard')
      const data = await res.json()
      setScorecard(data)
    } catch (e) {
      setError('Failed to generate analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        backdropFilter: 'blur(12px)',
        borderLeft: cfg.border,
        padding: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: cfg.color,
      }}
    >
      {/* Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.color}`,
            borderRadius: 8,
            padding: '4px 14px',
            color: cfg.color,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {cfg.label}
        </div>
        <div style={{ color: '#A1A1A6', fontSize: 14 }}>
          Career Capital Status — {quarterName}
        </div>
      </div>

      {/* Stat Chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {chips.map(chip => (
          <div
            key={chip.label}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '10px 16px',
              minWidth: 120,
            }}
          >
            <div style={{ color: '#F5F5F7', fontSize: 22, fontWeight: 700 }}>{chip.value}</div>
            <div style={{ color: '#6E6E73', fontSize: 11, marginTop: 2 }}>{chip.label}</div>
          </div>
        ))}
      </div>

      {/* Generate Button */}
      <button
        onClick={generateScorecard}
        disabled={loading}
        style={{
          background: loading ? 'rgba(184,164,255,0.2)' : 'rgba(184,164,255,0.15)',
          border: '1px solid rgba(184,164,255,0.4)',
          borderRadius: 8,
          color: '#B8A4FF',
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {loading && (
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid #B8A4FF',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
        {loading ? 'Analyzing…' : 'Generate Scorecard Analysis'}
      </button>

      {error && (
        <div style={{ color: '#FF9B87', fontSize: 13, marginTop: 12 }}>{error}</div>
      )}

      {/* AI Analysis */}
      {scorecard && (
        <div style={{ marginTop: 20 }}>
          <div style={{ color: '#6E6E73', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            AI Analysis
          </div>
          <div style={{ color: '#A1A1A6', fontSize: 13, marginBottom: 12, fontStyle: 'italic' }}>
            {scorecard.statusReason}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scorecard.insights.map((insight, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  background: `${insightColors[insight.type]}10`,
                  border: `1px solid ${insightColors[insight.type]}30`,
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <span style={{ color: insightColors[insight.type], fontSize: 14, marginTop: 1 }}>
                  {insight.type === 'positive' ? '✓' : insight.type === 'warning' ? '⚠' : '✗'}
                </span>
                <span style={{ color: '#F5F5F7', fontSize: 13 }}>{insight.text}</span>
              </div>
            ))}
          </div>

          {scorecard.recommendations.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: '#6E6E73', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scorecard.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span
                      style={{
                        background: rec.priority === 'high' ? 'rgba(255,155,135,0.2)' : 'rgba(236,198,102,0.2)',
                        color: rec.priority === 'high' ? '#FF9B87' : '#ECC666',
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}
                    >
                      {rec.priority}
                    </span>
                    <span style={{ color: '#A1A1A6', fontSize: 13 }}>{rec.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
