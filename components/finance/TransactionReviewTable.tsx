'use client'

import { useState } from 'react'
import Spinner from '@/components/ui/Spinner'

const CATEGORIES = [
  'incomes',
  'bills',
  'subscriptions',
  'expenses',
  'savings & investments',
  'debt',
] as const

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#6BE3A4',
  medium: '#F2C063',
  low: '#FF6B6B',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(96,165,250,0.12)', text: '#60A5FA', border: 'rgba(96,165,250,0.3)' },
  approved: { bg: 'rgba(107,227,164,0.12)', text: '#6BE3A4', border: 'rgba(107,227,164,0.3)' },
  duplicate: { bg: 'rgba(242,192,99,0.12)', text: '#F2C063', border: 'rgba(242,192,99,0.3)' },
  excluded: { bg: 'rgba(118,116,110,0.12)', text: '#76746E', border: 'rgba(118,116,110,0.3)' },
}

export interface TxRecord {
  id: string
  txDate: string
  description: string
  amount: number
  category: string | null
  subCategory: string | null
  account: string | null
  txStatus: string
  confidence: string | null
}

interface Props {
  transactions: TxRecord[]
  onSave: (updates: Partial<TxRecord>[]) => Promise<void>
  onApproveAll: () => Promise<void>
  statementMonth: string
  saving: boolean
}

export default function TransactionReviewTable({ transactions, onSave, onApproveAll, statementMonth, saving }: Props) {
  const [txs, setTxs] = useState<TxRecord[]>(transactions)
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  const update = (id: string, field: keyof TxRecord, value: string | null) => {
    setTxs(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    setDirty(prev => new Set(prev).add(id))
  }

  const toggleExclude = (id: string) => {
    setTxs(prev => prev.map(t => {
      if (t.id !== id) return t
      const newStatus = t.txStatus === 'excluded' ? 'pending' : 'excluded'
      return { ...t, txStatus: newStatus }
    }))
    setDirty(prev => new Set(prev).add(id))
  }

  const excludeAllDuplicates = () => {
    setTxs(prev => prev.map(t => t.txStatus === 'duplicate' ? { ...t, txStatus: 'excluded' } : t))
    const dupIds = txs.filter(t => t.txStatus === 'duplicate').map(t => t.id)
    setDirty(prev => {
      const next = new Set(prev)
      dupIds.forEach(id => next.add(id))
      return next
    })
  }

  const handleSave = async () => {
    const updates = txs.filter(t => dirty.has(t.id)).map(t => ({
      id: t.id,
      category: t.category,
      subCategory: t.subCategory,
      txStatus: t.txStatus,
      description: t.description,
      learnRule: dirty.has(t.id) && t.category !== null,
    }))
    await onSave(updates)
    setDirty(new Set())
  }

  const unresolvedDuplicates = txs.filter(t => t.txStatus === 'duplicate').length
  const includedCount = txs.filter(t => t.txStatus !== 'excluded' && t.txStatus !== 'duplicate').length
  const excludedCount = txs.filter(t => t.txStatus === 'excluded').length

  const formatAmount = (amt: number) => {
    const sign = amt >= 0 ? '+' : ''
    return `${sign}${amt.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#FAFAFA', fontSize: 18, fontWeight: 700 }}>
            Review {txs.length} transactions — {statementMonth}
          </h2>
          <p style={{ color: '#76746E', fontSize: 13, marginTop: 4 }}>
            {includedCount} to import · {excludedCount} excluded · {unresolvedDuplicates > 0 ? `${unresolvedDuplicates} duplicates` : 'no duplicates'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {unresolvedDuplicates > 0 && (
            <button
              onClick={excludeAllDuplicates}
              style={{
                background: 'rgba(242,192,99,0.1)',
                border: '1px solid rgba(242,192,99,0.3)',
                color: '#F2C063',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Exclude all duplicates
            </button>
          )}
          {dirty.size > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'rgba(180,167,229,0.15)',
                border: '1px solid rgba(180,167,229,0.4)',
                color: '#B4A7E5',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              Save changes
            </button>
          )}
          <button
            onClick={onApproveAll}
            disabled={saving || unresolvedDuplicates > 0}
            title={unresolvedDuplicates > 0 ? 'Resolve all duplicates first' : undefined}
            className="btn-motion"
            style={{
              background: unresolvedDuplicates > 0 ? 'rgba(118,116,110,0.1)' : 'rgba(107,227,164,0.15)',
              border: `1px solid ${unresolvedDuplicates > 0 ? 'rgba(118,116,110,0.3)' : 'rgba(107,227,164,0.4)'}`,
              color: unresolvedDuplicates > 0 ? '#76746E' : '#6BE3A4',
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: unresolvedDuplicates > 0 || saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            {saving ? (
              <>
                <Spinner size={13} color="#6BE3A4" strokeWidth={1.5} />
                Writing…
              </>
            ) : 'Approve All & Write to Excel'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Date', 'Description', 'Amount', 'Category', 'Sub-category', 'Conf.', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: '#76746E',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txs.map((tx, idx) => {
                const isDuplicate = tx.txStatus === 'duplicate'
                const isExcluded = tx.txStatus === 'excluded'
                const statusStyle = STATUS_COLORS[tx.txStatus] || STATUS_COLORS.pending
                return (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: idx < txs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: isDuplicate ? 'rgba(242,192,99,0.04)' : isExcluded ? 'rgba(118,116,110,0.04)' : 'transparent',
                      opacity: isExcluded ? 0.5 : 1,
                    }}
                  >
                    <td style={{ padding: '9px 14px', color: '#B8B6B0', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {tx.txDate}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#FAFAFA', fontSize: 13, maxWidth: 240 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isDuplicate && (
                          <span style={{ color: '#F2C063', marginRight: 6, fontSize: 11 }}>⚠ DUP</span>
                        )}
                        {tx.description}
                      </div>
                    </td>
                    <td style={{
                      padding: '9px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: tx.amount >= 0 ? '#6BE3A4' : '#FF6B6B',
                    }}>
                      {formatAmount(tx.amount)}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <select
                        value={tx.category || ''}
                        onChange={e => update(tx.id, 'category', e.target.value || null)}
                        style={{
                          background: '#16151A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#FAFAFA',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          minWidth: 160,
                        }}
                      >
                        <option value="">— select —</option>
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <input
                        type="text"
                        value={tx.subCategory || ''}
                        onChange={e => update(tx.id, 'subCategory', e.target.value || null)}
                        placeholder="sub-category"
                        style={{
                          background: '#16151A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#FAFAFA',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          width: 120,
                        }}
                      />
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span
                        title={tx.confidence || 'unknown'}
                        style={{
                          display: 'inline-block',
                          width: 8, height: 8,
                          borderRadius: '50%',
                          background: CONFIDENCE_COLORS[tx.confidence || ''] || '#76746E',
                        }}
                      />
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'capitalize' as const,
                      }}>
                        {tx.txStatus}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <button
                        onClick={() => toggleExclude(tx.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isExcluded ? '#6BE3A4' : '#76746E',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '2px 6px',
                        }}
                      >
                        {isExcluded ? 'Include' : 'Exclude'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
