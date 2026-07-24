'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LifeMenuItem } from '@/components/life-menu/LifeMenuBoard'

interface Props {
  items: LifeMenuItem[]
  userId: string
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_GROUPS = [
  {
    id: 'active',
    label: 'Wishlist',
    statuses: ['idea', 'wishlist', 'want_to_try'],
    color: '#61adff',
    emptyLabel: 'Nothing on your wishlist yet.',
  },
  {
    id: 'approved',
    label: 'Approved to Buy',
    statuses: ['approved', 'earned', 'planned', 'scheduled'],
    color: '#64f0aa',
    emptyLabel: 'Nothing approved.',
  },
  {
    id: 'bought',
    label: 'Bought',
    statuses: ['bought', 'tried', 'loved'],
    color: '#ffce53',
    emptyLabel: 'No purchases logged yet.',
  },
  {
    id: 'skipped',
    label: 'Skipped / On Hold',
    statuses: ['postponed', 'rejected', 'not_again', 'meh'],
    color: '#6E6E73',
    emptyLabel: '',
  },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  idea:         { label: 'Idea',        color: '#6E6E73' },
  want_to_try:  { label: 'Want',        color: '#61adff' },
  wishlist:     { label: 'Wishlist',    color: '#61adff' },
  planned:      { label: 'Planned',     color: '#a085ff' },
  scheduled:    { label: 'Scheduled',   color: '#a085ff' },
  approved:     { label: 'Approved',    color: '#64f0aa' },
  earned:       { label: 'Earned',      color: '#ffce53' },
  bought:       { label: 'Bought',      color: '#ffce53' },
  tried:        { label: 'Got it',      color: '#64f0aa' },
  loved:        { label: '❤️ Love it',  color: '#64f0aa' },
  meh:          { label: 'Meh',         color: '#A1A1A6' },
  not_again:    { label: '✗ Not again', color: '#ff8263' },
  postponed:    { label: 'On hold',     color: '#6E6E73' },
  rejected:     { label: 'Skipped',     color: '#6E6E73' },
}

const ALL_STATUSES = Object.keys(STATUS_META)

function fmtCost(cost: number | undefined, currency: string) {
  if (!cost) return null
  return currency === 'CZK'
    ? `${cost.toLocaleString('cs-CZ')} Kč`
    : `${cost.toLocaleString()} ${currency}`
}

// ─── Decision hint ─────────────────────────────────────────────────────────────

function decisionHint(item: LifeMenuItem): string | null {
  const cost = item.estimatedCost ?? 0
  const joy = item.joyScore ?? 0
  const regret = item.regretRisk ?? 0
  const utility = item.utilityScore ?? 0
  const goalSupport = item.goalSupportScore ?? 0

  if (cost <= 500 && joy >= 7 && regret <= 3) return '✅ Buy guilt-free'
  if (cost > 5000) return '🎯 Earn it first'
  if (regret >= 7) return '⏳ Wait 48h — high regret risk'
  if (goalSupport >= 7) return '📈 Supports a goal — approve'
  if (utility >= 7 && joy >= 6) return '🛍️ Good value — worth it'
  if (regret >= 5 && joy <= 5) return '🤔 Not sure — add to wishlist'
  return null
}

// ─── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ userId, onSaved, onCancel }: { userId: string; onSaved: (item: LifeMenuItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('CZK')
  const [status, setStatus] = useState('wishlist')
  const [joy, setJoy] = useState('')
  const [utility, setUtility] = useState('')
  const [regret, setRegret] = useState('')
  const [goalSupport, setGoalSupport] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#F5F5F7', padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none',
  }
  const labelStyle = {
    fontSize: 10, color: '#6E6E73', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 4,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/life-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: title.trim(),
          type: 'buy',
          estimatedCost: cost ? parseFloat(cost) : null,
          currency,
          status,
          joyScore: joy ? parseInt(joy) : null,
          utilityScore: utility ? parseInt(utility) : null,
          regretRisk: regret ? parseInt(regret) : null,
          goalSupportScore: goalSupport ? parseInt(goalSupport) : null,
          notesBefore: notes || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const item = await res.json() as LifeMenuItem
      onSaved(item)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Add to Budget List</div>

      {/* Title + Cost + Currency */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>What do you want to buy? *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Perfume, Gym shoes, Course…" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Estimated cost</label>
          <input type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Scores + Status */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Joy (1–10)</label>
          <input type="number" min="1" max="10" value={joy} onChange={e => setJoy(e.target.value)} placeholder="8" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Utility (1–10)</label>
          <input type="number" min="1" max="10" value={utility} onChange={e => setUtility(e.target.value)} placeholder="7" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Regret risk (1–10)</label>
          <input type="number" min="1" max="10" value={regret} onChange={e => setRegret(e.target.value)} placeholder="3" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Goal support (1–10)</label>
          <input type="number" min="1" max="10" value={goalSupport} onChange={e => setGoalSupport(e.target.value)} placeholder="5" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="idea">Idea</option>
            <option value="wishlist">Wishlist</option>
            <option value="approved">Approved</option>
            <option value="earned">Earned</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why this? When? Alternative?" style={inputStyle} />
      </div>

      {err && <div style={{ color: '#ff8263', fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !title.trim()} style={{
          background: 'rgba(255, 206, 83,0.12)', border: '1px solid rgba(255, 206, 83,0.3)',
          color: '#ffce53', borderRadius: 8, padding: '8px 20px', fontSize: 13,
          fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : '+ Add'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Item row ──────────────────────────────────────────────────────────────────

function BudgetItem({
  item,
  onStatusChange,
  onDelete,
}: {
  item: LifeMenuItem
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const statusMeta = STATUS_META[item.status] ?? { label: item.status, color: '#6E6E73' }
  const hint = decisionHint(item)
  const isBought = ['bought', 'tried', 'loved'].includes(item.status)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 16px',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      opacity: ['postponed', 'rejected'].includes(item.status) ? 0.5 : 1,
    }}>
      {/* Left: title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: '#F5F5F7',
          textDecoration: isBought ? 'line-through' : 'none',
          opacity: isBought ? 0.6 : 1,
          marginBottom: 4,
        }}>
          🛍️ {item.title}
        </div>

        {/* Score pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hint ? 8 : 0 }}>
          {item.joyScore && (
            <span style={{ fontSize: 10, color: '#64f0aa', background: 'rgba(100, 240, 170,0.1)', border: '1px solid rgba(100, 240, 170,0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>
              Joy {item.joyScore}/10
            </span>
          )}
          {item.utilityScore && (
            <span style={{ fontSize: 10, color: '#61adff', background: 'rgba(97, 173, 255,0.1)', border: '1px solid rgba(97, 173, 255,0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>
              Utility {item.utilityScore}/10
            </span>
          )}
          {(item.regretRisk ?? 0) >= 5 && (
            <span style={{ fontSize: 10, color: '#ff8263', background: 'rgba(255, 130, 99,0.1)', border: '1px solid rgba(255, 130, 99,0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>
              Regret risk {item.regretRisk}/10
            </span>
          )}
          {item.goalSupportScore && item.goalSupportScore >= 6 && (
            <span style={{ fontSize: 10, color: '#a085ff', background: 'rgba(160, 133, 255,0.1)', border: '1px solid rgba(160, 133, 255,0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>
              Goal support {item.goalSupportScore}/10
            </span>
          )}
        </div>

        {hint && !isBought && (
          <div style={{ fontSize: 12, color: '#A1A1A6', fontStyle: 'italic', marginBottom: 8 }}>{hint}</div>
        )}

        {item.notesBefore && (
          <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>{item.notesBefore}</div>
        )}
        {item.notesAfter && isBought && (
          <div style={{ fontSize: 12, color: '#64f0aa', fontStyle: 'italic', marginTop: 4 }}>"{item.notesAfter}"</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={item.status}
            onChange={e => onStatusChange(item.id, e.target.value)}
            style={{
              appearance: 'none' as const,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#A1A1A6', cursor: 'pointer',
            }}
          >
            {ALL_STATUSES.map(s => (
              <option key={s} value={s} style={{ background: '#0d0d0e' }}>{STATUS_META[s]?.label ?? s}</option>
            ))}
          </select>

          {!isBought && item.status !== 'approved' && item.status !== 'earned' && (
            <button
              onClick={() => onStatusChange(item.id, 'approved')}
              style={{ background: 'rgba(100, 240, 170,0.1)', border: '1px solid rgba(100, 240, 170,0.25)', color: '#64f0aa', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >
              ✓ Approve
            </button>
          )}
          {(item.status === 'approved' || item.status === 'earned') && (
            <button
              onClick={() => onStatusChange(item.id, 'bought')}
              style={{ background: 'rgba(255, 206, 83,0.1)', border: '1px solid rgba(255, 206, 83,0.25)', color: '#ffce53', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >
              🛍️ Mark Bought
            </button>
          )}
          {item.status !== 'postponed' && item.status !== 'rejected' && !isBought && (
            <button
              onClick={() => onStatusChange(item.id, 'postponed')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E73', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              Hold
            </button>
          )}

          <button
            onClick={() => onDelete(item.id)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#44444A', cursor: 'pointer', fontSize: 13, padding: '4px 6px' }}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Right: cost + status badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        {item.estimatedCost && (
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffce53', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCost(item.estimatedCost, item.currency)}
          </span>
        )}
        {item.actualCost && item.actualCost !== item.estimatedCost && (
          <span style={{ fontSize: 11, color: '#6E6E73', fontVariantNumeric: 'tabular-nums' }}>
            actual: {fmtCost(item.actualCost, item.currency)}
          </span>
        )}
        <span style={{
          background: `${statusMeta.color}18`, border: `1px solid ${statusMeta.color}30`,
          color: statusMeta.color, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700,
        }}>
          {statusMeta.label}
        </span>
      </div>
    </div>
  )
}

// ─── Main Board ────────────────────────────────────────────────────────────────

export default function BudgetBoard({ items: initItems, userId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<LifeMenuItem[]>(initItems)
  const [showForm, setShowForm] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['active', 'approved']))

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleStatusChange(id: string, status: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    await fetch(`/api/life-menu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
    router.refresh()
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/life-menu/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // Stats
  const wishlistItems = items.filter(i => ['idea', 'wishlist', 'want_to_try'].includes(i.status))
  const approvedItems = items.filter(i => ['approved', 'earned', 'planned', 'scheduled'].includes(i.status))
  const boughtItems = items.filter(i => ['bought', 'tried', 'loved'].includes(i.status))
  const wishlistBudget = wishlistItems.reduce((s, i) => s + (i.estimatedCost ?? 0), 0)
  const approvedBudget = approvedItems.reduce((s, i) => s + (i.estimatedCost ?? 0), 0)
  const spentBudget = boughtItems.reduce((s, i) => s + (i.actualCost ?? i.estimatedCost ?? 0), 0)

  return (
    <>
      {/* Stats */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Wishlist', value: wishlistItems.length, sub: wishlistBudget > 0 ? fmtCost(wishlistBudget, 'CZK') : null, color: '#61adff' },
          { label: 'Approved', value: approvedItems.length, sub: approvedBudget > 0 ? fmtCost(approvedBudget, 'CZK') : null, color: '#64f0aa' },
          { label: 'Bought', value: boughtItems.length, sub: spentBudget > 0 ? fmtCost(spentBudget, 'CZK') : null, color: '#ffce53' },
          { label: 'Total Wishlist', value: wishlistBudget > 0 ? fmtCost(wishlistBudget + approvedBudget, 'CZK') : '—', sub: null, color: '#a085ff' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: stat.label === 'Total Wishlist' ? 15 : 22, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{stat.label}</div>
            {stat.sub && <div style={{ fontSize: 11, color: stat.color, opacity: 0.7, marginTop: 2 }}>{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* Add button / form */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(255, 206, 83,0.1)', border: '1px solid rgba(255, 206, 83,0.25)',
          color: '#ffce53', borderRadius: 10, padding: '10px 18px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', marginBottom: 24,
        }}>
          + Add item
        </button>
      ) : (
        <AddForm userId={userId} onSaved={item => { setItems(prev => [item, ...prev]); setShowForm(false) }} onCancel={() => setShowForm(false)} />
      )}

      {/* Groups */}
      {STATUS_GROUPS.map(group => {
        const groupItems = items.filter(i => group.statuses.includes(i.status))
        if (groupItems.length === 0 && group.id === 'skipped') return null
        const isOpen = openGroups.has(group.id)

        return (
          <div key={group.id} style={{ marginBottom: 24 }}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 0', marginBottom: isOpen ? 12 : 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {group.label}
              </span>
              <span style={{ fontSize: 11, color: '#6E6E73', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '1px 7px' }}>
                {groupItems.length}
              </span>
              {groupItems.length > 0 && (
                <span style={{ fontSize: 12, color: group.color, opacity: 0.7, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(groupItems.reduce((s, i) => s + (i.actualCost ?? i.estimatedCost ?? 0), 0), 'CZK') ?? ''}
                </span>
              )}
              <span style={{ fontSize: 10, color: '#6E6E73', marginLeft: groupItems.length > 0 ? 0 : 'auto' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              groupItems.length === 0 ? (
                group.emptyLabel ? (
                  <div style={{ fontSize: 13, color: '#6E6E73', padding: '12px 0' }}>{group.emptyLabel}</div>
                ) : null
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupItems.map(item => (
                    <BudgetItem key={item.id} item={item} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                </div>
              )
            )}
          </div>
        )
      })}

      {items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6E6E73' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛍️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#A1A1A6', marginBottom: 6 }}>Your budget list is empty</div>
          <div style={{ fontSize: 13 }}>Add things you want to buy and track approvals.</div>
        </div>
      )}
    </>
  )
}
