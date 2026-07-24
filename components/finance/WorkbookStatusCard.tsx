'use client'

import { useRef, useState } from 'react'
import { put } from '@vercel/blob/client'
import { Cloud, BarChart2 } from 'lucide-react'

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
  // 0 = idle, 1 = getting token, 2 = uploading file, 3 = saving
  const [uploadPhase, setUploadPhase] = useState(0)

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr(null)
    setUploading(true)
    setUploadPct(0)
    setUploadPhase(1)

    // Abort the entire operation after 5 minutes
    const controller = new AbortController()
    const killswitch = setTimeout(() => controller.abort(), 5 * 60 * 1000)

    try {
      // Step 0: quick server-side Blob store health check
      setUploadPhase(1)
      const checkRes = await fetch('/api/finance/workbook/check-blob', { signal: controller.signal })
      const check = await checkRes.json() as { ok: boolean; message: string; fix?: string }
      if (!check.ok) {
        throw new Error(`${check.message}${check.fix ? `\n\n${check.fix}` : ''}`)
      }

      // Step 1: get a 10-minute client token (server-side; default is 30s — too short)
      const tokenRes = await fetch(`/api/finance/workbook/blob-token?userId=${userId}`, {
        signal: controller.signal,
      })
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Failed to get upload token')
      }
      const { clientToken, pathname } = await tokenRes.json() as { clientToken: string; pathname: string }

      // Step 2: upload directly from browser → Vercel Blob CDN
      setUploadPhase(2)
      setUploadPct(0)
      const blob = await put(pathname, file, {
        token: clientToken,
        access: 'private', // Blob store is configured as private-only
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          setUploadPct(Math.round(Math.min(percentage, 98)))
        },
      })

      setUploadPct(100)
      setUploadPhase(3)

      const blobUrl = blob.url

      // Step 3: save blob URL to DB
      const saveRes = await fetch('/api/finance/workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, blobUrl }),
        signal: controller.signal,
      })
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Failed to save workbook URL')
      }
      if (onUploadWorkbook) await onUploadWorkbook(blobUrl)
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'Upload timed out after 5 min — Vercel Blob may not be configured correctly.' : err.message)
        : 'Upload failed'
      setUploadErr(msg)
    } finally {
      clearTimeout(killswitch)
      setUploading(false)
      setUploadPct(0)
      setUploadPhase(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!workbook) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#ff8168', fontSize: 13, fontWeight: 600 }}>No workbook connected</p>
            <p style={{ color: '#6E6E73', fontSize: 12, marginTop: 4 }}>Upload your Finance Tracker .xlsx to connect it</p>
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
                background: 'rgba(160, 133, 255,0.15)',
                border: '1px solid rgba(160, 133, 255,0.4)',
                color: '#a085ff', padding: '10px 22px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.9 : 1, minWidth: 160,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                {!uploading ? <><Cloud size={13} /> Upload Workbook</> : uploadPhase === 1 ? 'Preparing…' : uploadPhase === 3 ? 'Saving…' : uploadPct >= 98 ? 'Finalizing…' : `Uploading ${uploadPct}%`}
              </span>
              {uploading && (
                <div style={{ width: '100%', height: 3, background: 'rgba(160, 133, 255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                  {uploadPct >= 98 ? (
                    /* Pulsing stripe during finalization so it doesn't look frozen */
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'linear-gradient(90deg, rgba(160, 133, 255,0.4) 0%, rgba(160, 133, 255,0.9) 50%, rgba(160, 133, 255,0.4) 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                      width: '100%',
                    }} />
                  ) : (
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'rgba(160, 133, 255,0.8)',
                      width: `${uploadPct}%`,
                      transition: 'width 0.4s ease',
                    }} />
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
        {uploadErr && (
          <div style={{
            background: 'rgba(255, 129, 104,0.1)', border: '1px solid rgba(255, 129, 104,0.3)',
            color: '#ff8168', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 4,
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
            background: 'rgba(100, 240, 170,0.12)',
            border: '1px solid rgba(100, 240, 170,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {isCloud ? <Cloud size={18} /> : <BarChart2 size={18} />}
          </div>
          <div>
            <p style={{ color: '#F5F5F7', fontWeight: 600, fontSize: 15 }}>{workbook.fileName}</p>
            <p style={{ color: '#6E6E73', fontSize: 12, marginTop: 2 }}>
              {isCloud ? 'Cloud storage' : 'Local file'} · Connected {formatDate(workbook.connectedAt)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(100, 240, 170,0.1)',
            border: '1px solid rgba(100, 240, 170,0.25)',
            color: '#64f0aa',
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
          }}>
            {isCloud ? <><Cloud size={10} />CLOUD</> : 'CONNECTED'}
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
              color: '#6E6E73', padding: '4px 10px', borderRadius: 6,
              fontSize: 11, cursor: uploading ? 'not-allowed' : 'pointer', minWidth: 80,
            }}
          >
            <span>{!uploading ? '↑ Replace' : uploadPhase === 1 ? '…' : uploadPhase === 3 ? '✓' : uploadPct >= 98 ? '…' : `${uploadPct}%`}</span>
            {uploading && (
              <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: 'rgba(160, 133, 255,0.6)',
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
          background: 'rgba(255, 129, 104,0.1)', border: '1px solid rgba(255, 129, 104,0.3)',
          color: '#ff8168', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 12,
        }}>
          {uploadErr}
        </div>
      )}

      <div className="mob-1col" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Last Import</p>
          <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{formatDate(workbook.lastImportAt)}</p>
        </div>
        <div>
          <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Last Month</p>
          <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{workbook.lastImportMonth || '—'}</p>
        </div>
        <div>
          <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Auto-rules</p>
          <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{ruleCount}</p>
        </div>
      </div>
    </div>
  )
}
