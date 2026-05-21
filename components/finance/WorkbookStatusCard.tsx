'use client'

import { useRef, useState } from 'react'
import { put } from '@vercel/blob/client'

interface WorkbookData {
  id: string
  fileName: string
  connectedAt: string
  lastImportAt: string | null
  lastImportMonth: string | null
  blobUrl?: string | null
}

interface Props {
  workbook: WorkbookData | null
  ruleCount: number
  onConnect: () => void
  onUploadWorkbook?: (blobUrl: string) => Promise<void>
  userId: string
}

export default function WorkbookStatusCard({ workbook, ruleCount, onConnect, onUploadWorkbook, userId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState(0)

  // Simulate upload progress (real progress not available via @vercel/blob/client)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startProgress = () => {
    setUploadPct(0)
    progressRef.current = setInterval(() => {
      setUploadPct(prev => {
        if (prev >= 90) { clearInterval(progressRef.current!); return 90 }
        return prev + Math.random() * 8
      })
    }, 400)
  }
  const finishProgress = () => {
    clearInterval(progressRef.current!)
    setUploadPct(100)
    setTimeout(() => setUploadPct(0), 800)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr(null)
    setUploading(true)
    startProgress()
    try {
      // Step 1: get a 10-minute client token (default is 30s — too short for large files)
      const tokenRes = await fetch(`/api/finance/workbook/blob-token?userId=${userId}`)
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Failed to get upload token')
      }
      const { clientToken, pathname } = await tokenRes.json() as { clientToken: string; pathname: string }

      // Step 2: upload directly from browser → Vercel Blob CDN with the long-lived token
      const blob = await put(pathname, file, {
        token: clientToken,
        access: 'public',
      })
      finishProgress()

      const blobUrl = blob.url

      // Step 3: save blob URL to DB
      const saveRes = await fetch('/api/finance/workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, blobUrl }),
      })
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Failed to save workbook URL')
      }
      if (onUploadWorkbook) await onUploadWorkbook(blobUrl)
    } catch (err) {
      finishProgress()
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setUploadErr(msg)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!workbook) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#FF6B6B', fontSize: 13, fontWeight: 600 }}>No workbook connected</p>
            <p style={{ color: '#76746E', fontSize: 12, marginTop: 4 }}>Upload your Finance Tracker .xlsx to connect it</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {/* Upload to Vercel Blob */}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-motion"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'rgba(180,167,229,0.15)',
                border: '1px solid rgba(180,167,229,0.4)',
                color: '#B4A7E5', padding: '10px 22px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.9 : 1, minWidth: 160,
              }}
            >
              <span>{uploading ? `Uploading… ${Math.round(uploadPct)}%` : '☁️ Upload Workbook'}</span>
              {uploading && (
                <div style={{ width: '100%', height: 3, background: 'rgba(180,167,229,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'rgba(180,167,229,0.8)',
                    width: `${uploadPct}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </button>
          </div>
        </div>
        {uploadErr && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#FF6B6B', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 4,
          }}>
            {uploadErr}
          </div>
        )}
      </div>
    )
  }

  const isCloud = !!workbook.blobUrl

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(107,227,164,0.12)',
            border: '1px solid rgba(107,227,164,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {isCloud ? '☁️' : '📊'}
          </div>
          <div>
            <p style={{ color: '#FAFAFA', fontWeight: 600, fontSize: 15 }}>{workbook.fileName}</p>
            <p style={{ color: '#76746E', fontSize: 12, marginTop: 2 }}>
              {isCloud ? 'Cloud storage' : 'Local file'} · Connected {formatDate(workbook.connectedAt)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'rgba(107,227,164,0.1)',
            border: '1px solid rgba(107,227,164,0.25)',
            color: '#6BE3A4',
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
          }}>
            {isCloud ? '☁️ CLOUD' : 'CONNECTED'}
          </div>
          {/* Re-upload button */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Replace workbook"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#76746E', padding: '4px 10px', borderRadius: 6,
              fontSize: 11, cursor: uploading ? 'not-allowed' : 'pointer', minWidth: 80,
            }}
          >
            <span>{uploading ? `${Math.round(uploadPct)}%` : '↑ Replace'}</span>
            {uploading && (
              <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: 'rgba(180,167,229,0.6)',
                  width: `${uploadPct}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </button>
        </div>
      </div>
      {uploadErr && (
        <div style={{
          background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
          color: '#FF6B6B', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 12,
        }}>
          {uploadErr}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Last Import</p>
          <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{formatDate(workbook.lastImportAt)}</p>
        </div>
        <div>
          <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Last Month</p>
          <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{workbook.lastImportMonth || '—'}</p>
        </div>
        <div>
          <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Auto-rules</p>
          <p style={{ color: '#FAFAFA', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{ruleCount}</p>
        </div>
      </div>
    </div>
  )
}
