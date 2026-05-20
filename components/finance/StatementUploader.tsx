'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function StatementUploader({ userId }: { userId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ transactionCount: number; reviewNeeded: number } | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function uploadFile(file: File) {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', userId)

      const res = await fetch('/api/finance/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ transactionCount: data.transactionCount, reviewNeeded: data.reviewNeeded })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'rgba(180,167,229,0.6)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(180,167,229,0.05)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        {loading ? (
          <div>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <p style={{ color: '#B4A7E5', fontSize: 14, fontWeight: 600 }}>Processing...</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drop your statement here
            </p>
            <p style={{ color: '#76746E', fontSize: 13 }}>or click to browse — CSV or XLSX accepted</p>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {error && (
        <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 10 }}>{error}</p>
      )}

      {result && (
        <div style={{
          marginTop: 12, background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)',
          borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 24,
        }}>
          <div>
            <span style={{ color: '#6BE3A4', fontWeight: 700, fontSize: 18 }}>{result.transactionCount}</span>
            <span style={{ color: '#B8B6B0', fontSize: 13, marginLeft: 6 }}>transactions imported</span>
          </div>
          {result.reviewNeeded > 0 && (
            <div>
              <span style={{ color: '#F2C063', fontWeight: 700, fontSize: 18 }}>{result.reviewNeeded}</span>
              <span style={{ color: '#B8B6B0', fontSize: 13, marginLeft: 6 }}>need review</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
