'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface GoalRowProps {
  goal: {
    id: string
    title: string
    category: string
    strategicRole: string | null
    deadline: string
    progressPct: number
    metrics: {
      status: string
      statusLabel: string
      expectedPct: number
      gap: number
    }
  }
}

const ROLE_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'career_capital', label: 'Career Capital' },
  { value: 'learning', label: 'Learning' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'finance', label: 'Finance' },
  { value: 'high_upside_bet', label: 'High-Upside Bet' },
  { value: 'long_term', label: 'Long-Term' },
]

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  career_capital: { label: 'Career Capital', color: '#B8A4FF', bg: 'rgba(184,164,255,0.12)' },
  learning: { label: 'Learning', color: '#80BDFF', bg: 'rgba(128,189,255,0.12)' },
  fitness: { label: 'Fitness', color: '#7FD5AA', bg: 'rgba(127,213,170,0.12)' },
  finance: { label: 'Finance', color: '#ECC666', bg: 'rgba(236,198,102,0.12)' },
  high_upside_bet: { label: 'High-Upside Bet', color: '#F5A56A', bg: 'rgba(255,159,107,0.12)' },
  long_term: { label: 'Long-Term', color: '#80BDFF', bg: 'rgba(77,217,217,0.12)' },
}

const STATUS_COLORS: Record<string, string> = {
  ahead: '#7FD5AA',
  on_track: '#7FD5AA',
  watch: '#ECC666',
  at_risk: '#F5A56A',
  critical: '#FF9B87',
  completed: '#B8A4FF',
  paused: '#6E6E73',
}

export default function QuarterlyGoalRow({ goal }: GoalRowProps) {
  const router = useRouter()
  const [role, setRole] = useState(goal.strategicRole || '')
  const [saving, setSaving] = useState(false)

  async function handleRoleChange(newRole: string) {
    setRole(newRole)
    setSaving(true)
    try {
      await fetch(`/api/goals/${goal.id}/strategic-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategicRole: newRole || null }),
      })
      router.refresh()
    } catch {
      // silently fail; optimistic update already applied
    } finally {
      setSaving(false)
    }
  }

  const statusColor = STATUS_COLORS[goal.metrics.status] || '#6E6E73'
  const roleMeta = role ? ROLE_META[role] : null
  const gapColor = goal.metrics.gap >= 0 ? '#7FD5AA' : goal.metrics.gap >= -10 ? '#ECC666' : '#FF9B87'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 120px 80px 60px 60px 80px 90px',
        gap: 8,
        padding: '8px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        alignItems: 'center',
      }}
    >
      {/* Status dot */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
      </div>

      {/* Goal title */}
      <div>
        <Link
          href={`/goals/${goal.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', textDecoration: 'none' }}
        >
          {goal.title}
        </Link>
        <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 1 }}>{goal.category}</div>
      </div>

      {/* Strategic role badge + inline select */}
      <div>
        {roleMeta ? (
          <select
            value={role}
            onChange={e => handleRoleChange(e.target.value)}
            disabled={saving}
            style={{
              background: roleMeta.bg,
              border: `1px solid ${roleMeta.color}40`,
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 10,
              fontWeight: 700,
              color: roleMeta.color,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} style={{ background: '#0d0d0e', color: '#F5F5F7' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            value=""
            onChange={e => handleRoleChange(e.target.value)}
            disabled={saving}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 10,
              color: '#6E6E73',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} style={{ background: '#0d0d0e', color: '#F5F5F7' }}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(goal.progressPct)}%
        </div>
        <div style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min(100, goal.progressPct)}%`,
              background: statusColor,
              borderRadius: 2,
            }}
          />
          {/* Expected marker */}
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: `${Math.min(100, goal.metrics.expectedPct)}%`,
              width: 2,
              height: 6,
              background: '#6E6E73',
              borderRadius: 1,
            }}
          />
        </div>
      </div>

      {/* Gap */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: gapColor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {goal.metrics.gap >= 0 ? '+' : ''}{Math.round(goal.metrics.gap)}%
      </div>

      {/* Expected */}
      <div style={{ fontSize: 11, color: '#6E6E73', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(goal.metrics.expectedPct)}%
      </div>

      {/* Deadline */}
      <div style={{ fontSize: 11, color: '#6E6E73' }}>
        {new Date(goal.deadline).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
      </div>

      {/* Status badge */}
      <div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            background: `${statusColor}18`,
            color: statusColor,
            border: `1px solid ${statusColor}30`,
          }}
        >
          {goal.metrics.statusLabel}
        </span>
      </div>
    </div>
  )
}
