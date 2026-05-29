'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BankStatement, Transaction, TransactionRule } from '@prisma/client'

const CATEGORIES = [
  'Groceries', 'Restaurants', 'Transport', 'Utilities', 'Rent',
  'Healthcare', 'Entertainment', 'Shopping', 'Subscriptions', 'Income', 'Savings', 'Other',
]

interface Props {
  statement: BankStatement & { transactions: Transaction[] }
  rules: TransactionRule[]
  userId: string
}

export default function TransactionReviewer({ statement, rules: _rules, userId: _userId }: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState(statement.transactions)
  const [committing, setCommitting] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [committed, setCommitted] = useState(statement.status === 'committed')
  const [error, setError] = useState('')

  async function updateCategory(txId: string, category: string) {
    const res = await fetch(`/api/finance/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    if (res.ok) {
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, category } : t))
    }
  }

  async function commitAll() {
    setCommitting(true)
    setError('')
    try {
      const res = await fetch(`/api/finance/statements/${statement.id}/commit`, {
        method: 'PATCH',
      })
      if (!res.ok) throw new Error('Commit failed')
      setCommitted(true)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCommitting(false)
    }
  }

  async function generateReport() {
    setGeneratingReport(true)
    setError('')
    try {
      const res = await fetch('/api/finance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: statement.id, userId: statement.userId }),
      })
      if (!res.ok) throw new Error('Report generation failed')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGeneratingReport(false)
    }
  }

  const reviewNeeded = transactions.filter(t => t.needsReview).length

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7' }}>
            Transactions
            <span style={{ color: '#6E6E73', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
              {transactions.length} total
            </span>
          </h3>
          {reviewNeeded > 0 && (
            <p style={{ color: '#ECC666', fontSize: 13, marginTop: 2 }}>
              {reviewNeeded} need review
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!committed && (
            <button
              onClick={commitAll}
              disabled={committing}
              style={{
                background: 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.4)',
                color: '#7FD5AA', padding: '7px 16px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: committing ? 'not-allowed' : 'pointer',
              }}
            >
              {committing ? 'Committing...' : 'Commit All'}
            </button>
          )}
          {committed && (
            <button
              onClick={generateReport}
              disabled={generatingReport}
              style={{
                background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.4)',
                color: '#B8A4FF', padding: '7px 16px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: generatingReport ? 'not-allowed' : 'pointer',
              }}
            >
              {generatingReport ? 'Generating...' : 'Generate Monthly Report'}
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: '#FF9B87', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Date', 'Merchant / Description', 'Amount', 'Category', 'Review'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '8px 10px',
                  color: '#6E6E73', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => {
              const isReview = tx.needsReview || (tx.confidence !== null && tx.confidence !== undefined && tx.confidence < 0.6)
              return (
                <tr
                  key={tx.id}
                  style={{
                    background: isReview ? 'rgba(236,198,102,0.04)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <td style={{ padding: '8px 10px', color: '#A1A1A6', whiteSpace: 'nowrap' }}>
                    {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#F5F5F7', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.merchant || tx.description || '—'}
                    </div>
                    {tx.description && tx.merchant && (
                      <div style={{ color: '#6E6E73', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </div>
                    )}
                  </td>
                  <td style={{
                    padding: '8px 10px', fontWeight: 600,
                    color: tx.isIncoming ? '#7FD5AA' : '#F5F5F7',
                    whiteSpace: 'nowrap',
                  }}>
                    {tx.isIncoming ? '+' : ''}{tx.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} {tx.currency}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={tx.category || ''}
                      onChange={e => updateCategory(tx.id, e.target.value)}
                      disabled={committed}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6, padding: '4px 8px', color: '#F5F5F7', fontSize: 12,
                        cursor: committed ? 'default' : 'pointer',
                      }}
                    >
                      <option value="">Uncategorized</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {isReview && (
                      <span style={{ color: '#ECC666', fontSize: 11, fontWeight: 700 }}>⚠️ Review</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
