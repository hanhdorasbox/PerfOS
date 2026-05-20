'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

export default function GenerateReportButton({ statementId, userId }: { statementId: string; userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/finance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId, userId }),
      })
      if (!res.ok) throw new Error('Failed')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="btn-motion"
        style={{
          background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
          color: '#B4A7E5', padding: '8px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}
      >
        {loading ? (
          <>
            <Spinner size={13} color="#6BE3A4" strokeWidth={1.5} />
            Generating…
          </>
        ) : 'Generate Monthly Report'}
      </button>
      {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  )
}
