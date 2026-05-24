'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import WorkbookStatusCard from './WorkbookStatusCard'
import TransactionReviewTable, { TxRecord } from './TransactionReviewTable'
import FinancialReport from './FinancialReport'
import StepProgress, { type ProgressStep } from '@/components/ui/StepProgress'
import Spinner from '@/components/ui/Spinner'

type Step = 'overview' | 'upload' | 'review' | 'approved' | 'report'

const PDF_UPLOAD_STEPS: string[] = [
  'Uploading file',
  'Reading document with AI',
  'Extracting transactions',
  'Categorising and checking duplicates',
  'Preparing review table',
]
const CSV_UPLOAD_STEPS: string[] = [
  'Uploading file',
  'Parsing statement',
  'Categorising transactions',
  'Preparing review table',
]

interface WorkbookData {
  id: string
  fileName: string
  connectedAt: string
  lastImportAt: string | null
  lastImportMonth: string | null
}

interface ImportRecord {
  id: string
  statementMonth: string
  status: string
  transactionCount?: number
  sourceFileName?: string | null
  createdAt?: string
  _count?: { transactions: number }
}

interface ReportRecord {
  id: string
  reportMonth: string
  narrative: string
  chartData: string | null
  summaryData: string
  createdAt: string
}

interface WorkbookStatus {
  connected: boolean
  workbook: WorkbookData | null
  ruleCount: number
  pendingImport: ImportRecord | null
  latestReport: ReportRecord | null
  pastImports?: ImportRecord[]
}

interface Props {
  userId: string
}

export default function FinanceDashboard({ userId }: Props) {
  const [step, setStep] = useState<Step>('overview')
  const [status, setStatus] = useState<WorkbookStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStepIndex, setUploadStepIndex] = useState(0)
  const [uploadStepLabels, setUploadStepLabels] = useState<string[]>(PDF_UPLOAD_STEPS)
  const [saving, setSaving] = useState(false)
  const [importId, setImportId] = useState<string | null>(null)
  const [importData, setImportData] = useState<{ statementMonth: string; transactions: TxRecord[] } | null>(null)
  const [approvedCount, setApprovedCount] = useState(0)
  const [reportData, setReportData] = useState<ReportRecord | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pastImports, setPastImports] = useState<ImportRecord[]>([])
  const [deletingImport, setDeletingImport] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/workbook?userId=${userId}`)
      let data: WorkbookStatus & { error?: string }
      try {
        data = await res.json()
      } catch {
        throw new Error(`Server returned non-JSON (status ${res.status})`)
      }
      if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`)
      setStatus(data)
      setPastImports(data.pastImports ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workbook status')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const connectWorkbook = async () => {
    setError(null)
    try {
      const res = await fetch('/api/finance/workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try {
          const body = await res.json() as { error?: string }
          if (body.error) errMsg = body.error
        } catch { /* non-JSON body */ }
        throw new Error(errMsg)
      }
      await fetchStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect workbook')
    }
  }

  const uploadWorkbookFile = async (_blobUrl: string) => {
    // Blob URL already saved to DB by WorkbookStatusCard — just refresh status
    await fetchStatus()
  }

  const handleFileUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    setUploadStepIndex(0)

    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
    const steps = isPDF ? PDF_UPLOAD_STEPS : CSV_UPLOAD_STEPS
    setUploadStepLabels(steps)

    // Advance through visual steps while the upload is running
    // Timings are calibrated: PDFs take ~15s, CSVs ~2s
    const delays = isPDF ? [0, 1500, 5500, 10500, 13500] : [0, 600, 1200, 1800]
    uploadTimersRef.current.forEach(t => clearTimeout(t))
    uploadTimersRef.current = delays.map((d, i) =>
      setTimeout(() => setUploadStepIndex(i), d)
    )

    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('file', file)

      const res = await fetch('/api/finance/import/new', { method: 'POST', body: formData })

      let data: { importId?: string; statementMonth?: string; transactionCount?: number; error?: string }
      try {
        data = await res.json()
      } catch {
        throw new Error('The server returned an unreadable response. Please try again.')
      }

      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')
      if (!data.importId) throw new Error('Import created but ID was missing. Please refresh and retry.')

      setImportId(data.importId)

      // Fetch import detail
      const detailRes = await fetch(`/api/finance/import/${data.importId}`)
      if (!detailRes.ok) throw new Error('Failed to load transaction details.')

      let detail: { statementMonth: string; transactions: TxRecord[] }
      try {
        detail = await detailRes.json()
      } catch {
        throw new Error('Transaction data could not be read. Please try again.')
      }

      setImportData(detail)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      uploadTimersRef.current.forEach(t => clearTimeout(t))
      uploadTimersRef.current = []
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleSaveTransactions = async (updates: Partial<TxRecord>[]) => {
    if (!importId) return
    setSaving(true)
    try {
      await fetch(`/api/finance/import/${importId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: updates, userId }),
      })
      // Refresh import data
      const detailRes = await fetch(`/api/finance/import/${importId}`)
      const detail = await detailRes.json() as { statementMonth: string; transactions: TxRecord[] }
      setImportData(detail)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleApproveAll = async () => {
    if (!importId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/finance/import/${importId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json() as { success?: boolean; report?: ReportRecord; error?: string; excelWritten?: boolean; excelError?: string }
      if (!res.ok) throw new Error(data.error || 'Approval failed')
      setApprovedCount(importData?.transactions.filter(t => t.txStatus !== 'excluded' && t.txStatus !== 'duplicate').length || 0)
      setReportData(data.report!)
      // Show non-blocking warning if Excel write failed but transactions were still approved
      if (data.excelError) {
        setError(`⚠️ Transactions approved in database, but Excel write failed: ${data.excelError}. Re-upload your workbook to fix this.`)
      }
      setStep('approved')
      await fetchStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
    } finally {
      setSaving(false)
    }
  }

  const resumePendingImport = async (pending: ImportRecord) => {
    setImportId(pending.id)
    const detailRes = await fetch(`/api/finance/import/${pending.id}`)
    const detail = await detailRes.json() as { statementMonth: string; transactions: TxRecord[] }
    setImportData(detail)
    setStep('review')
  }

  const deleteImport = async (importId: string) => {
    setDeletingImport(importId)
    try {
      const res = await fetch(`/api/finance/import/${importId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      // Remove from past imports list
      setPastImports(prev => prev.filter(i => i.id !== importId))
      // Also clear pending import banner if that's what was deleted
      if (status?.pendingImport?.id === importId) {
        setStatus(prev => prev ? { ...prev, pendingImport: null } : prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete import')
    } finally {
      setDeletingImport(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#76746E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Spinner size={18} color="#76746E" strokeWidth={2} />
        <span>Loading…</span>
      </div>
    )
  }

  // ─── Overview ───────────────────────────────────────────────────────────────
  if (step === 'overview') {
    return (
      <div className="animate-entrance">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Finance</h1>
            <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>Your Excel financial dashboard, connected.</p>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#FF6B6B', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <WorkbookStatusCard
          workbook={status?.workbook ?? null}
          ruleCount={status?.ruleCount ?? 0}
          onConnect={connectWorkbook}
          onUploadWorkbook={uploadWorkbookFile}
          userId={userId}
        />

        {/* Primary CTA */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, marginBottom: 28 }}>
          <button
            onClick={() => setStep('upload')}
            style={{
              background: 'rgba(180,167,229,0.15)',
              border: '1px solid rgba(180,167,229,0.4)',
              color: '#B4A7E5',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            Import Bank Statement
          </button>
          {status?.latestReport && (
            <button
              onClick={() => { setReportData(status.latestReport!); setStep('report') }}
              style={{
                background: 'rgba(107,227,164,0.1)',
                border: '1px solid rgba(107,227,164,0.3)',
                color: '#6BE3A4',
                padding: '12px 24px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Latest Report
            </button>
          )}
        </div>

        {/* Pending import banner */}
        {status?.pendingImport && (
          <div className="card" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '14px 20px', marginBottom: 20,
            border: '1px solid rgba(242,192,99,0.3)',
            background: 'rgba(242,192,99,0.05)',
          }}>
            <div>
              <p style={{ color: '#F2C063', fontWeight: 600, fontSize: 14 }}>
                Pending review — {status.pendingImport.statementMonth}
              </p>
              <p style={{ color: '#76746E', fontSize: 12, marginTop: 2 }}>
                You have an import waiting for review
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {confirmDeleteId === status.pendingImport.id ? (
                <>
                  <span style={{ fontSize: 12, color: '#F2C063' }}>Discard import?</span>
                  <button
                    onClick={() => deleteImport(status.pendingImport!.id)}
                    disabled={deletingImport === status.pendingImport.id}
                    className="btn-motion"
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)', color: '#FF6B6B', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {deletingImport === status.pendingImport.id ? <Spinner size={12} color="#FF6B6B" strokeWidth={2} /> : null}
                    Yes, discard
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} className="btn-motion" style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#76746E' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => resumePendingImport(status.pendingImport!)}
                    className="btn-motion"
                    style={{ background: 'rgba(242,192,99,0.15)', border: '1px solid rgba(242,192,99,0.4)', color: '#F2C063', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Resume Review
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(status.pendingImport!.id)}
                    className="btn-motion"
                    style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#76746E' }}
                  >
                    Discard
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Import history */}
        {pastImports.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#76746E', marginBottom: 12 }}>
              — Import History
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {pastImports.map((imp, i) => {
                const isDeleting = deletingImport === imp.id
                const txCount = imp._count?.transactions ?? imp.transactionCount ?? 0
                return (
                  <div
                    key={imp.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 18px',
                      borderBottom: i < pastImports.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      opacity: isDeleting ? 0.4 : 1,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {/* Month badge */}
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: '#B4A7E5',
                      background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.2)',
                      borderRadius: 6, padding: '3px 10px', flexShrink: 0, minWidth: 68, textAlign: 'center',
                    }}>
                      {imp.statementMonth}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#FAFAFA', fontWeight: 500 }}>
                        {imp.sourceFileName || 'Bank statement'}
                      </div>
                      <div style={{ fontSize: 11, color: '#76746E', marginTop: 1 }}>
                        {txCount} transaction{txCount !== 1 ? 's' : ''}
                        {imp.createdAt && ` · ${new Date(imp.createdAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </div>
                    </div>

                    {/* Status pill */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                      background: imp.status === 'written' ? 'rgba(107,227,164,0.1)' : 'rgba(96,165,250,0.1)',
                      border: `1px solid ${imp.status === 'written' ? 'rgba(107,227,164,0.25)' : 'rgba(96,165,250,0.25)'}`,
                      color: imp.status === 'written' ? '#6BE3A4' : '#60A5FA',
                      textTransform: 'uppercase',
                    }}>
                      {imp.status === 'written' ? 'Written' : 'Approved'}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteImport(imp.id)}
                      disabled={isDeleting}
                      className="btn-motion"
                      title="Delete this import"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#76746E', fontSize: 14, padding: '4px 6px', flexShrink: 0,
                        borderRadius: 6, lineHeight: 1,
                      }}
                    >
                      {isDeleting ? <Spinner size={13} color="#76746E" strokeWidth={1.5} /> : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Latest report preview */}
        {status?.latestReport && (
          <FinancialReport report={status.latestReport} />
        )}
      </div>
    )
  }

  // ─── Upload ──────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => setStep('overview')}
            style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 13 }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FAFAFA' }}>Import Bank Statement</h1>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#FF6B6B', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div
          className="card"
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            border: dragOver
              ? '2px dashed rgba(180,167,229,0.6)'
              : '2px dashed rgba(255,255,255,0.1)',
            background: dragOver ? 'rgba(180,167,229,0.05)' : undefined,
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          {uploading ? (
            <div style={{ textAlign: 'left' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Spinner size={18} color="#B4A7E5" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#B4A7E5' }}>Processing your statement…</span>
              </div>
              <StepProgress
                compact
                steps={uploadStepLabels.map((label, i): ProgressStep => ({
                  label,
                  status: i < uploadStepIndex ? 'done'
                        : i === uploadStepIndex ? 'active'
                        : 'pending',
                }))}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p style={{ color: '#FAFAFA', fontSize: 16, fontWeight: 600 }}>Drop your bank statement here</p>
              <p style={{ color: '#76746E', fontSize: 13, marginTop: 8 }}>or click to browse — PDF or CSV</p>
              <p style={{ color: '#76746E', fontSize: 11, marginTop: 16 }}>
                Supports PDF and CSV exports from Czech banks (ČSOB, Komerční banka, Fio, Moneta, Raiffeisen)
              </p>
              <p style={{ color: '#76746E', fontSize: 11, marginTop: 4 }}>
                PDF files are read by AI — transactions are extracted automatically
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Review ──────────────────────────────────────────────────────────────────
  if (step === 'review' && importData) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => setStep('overview')}
            style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 13 }}
          >
            ← Back
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#FF6B6B', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <TransactionReviewTable
          transactions={importData.transactions}
          onSave={handleSaveTransactions}
          onApproveAll={handleApproveAll}
          statementMonth={importData.statementMonth}
          saving={saving}
        />
      </div>
    )
  }

  // ─── Approved ────────────────────────────────────────────────────────────────
  if (step === 'approved') {
    const excelFailed = error?.startsWith('⚠️')
    return (
      <div style={{ textAlign: 'center', padding: '60px 32px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{excelFailed ? '✅' : '✅'}</div>
        <h2 style={{ color: '#6BE3A4', fontSize: 24, fontWeight: 700 }}>
          {approvedCount} transactions approved
        </h2>
        <p style={{ color: '#76746E', fontSize: 14, marginTop: 8 }}>
          {excelFailed ? 'Saved to database — Excel update pending' : 'Transactions saved to database and Excel workbook'}
        </p>
        {excelFailed && error && (
          <div style={{
            maxWidth: 500, margin: '16px auto 0',
            background: 'rgba(242,192,99,0.08)', border: '1px solid rgba(242,192,99,0.25)',
            borderRadius: 8, padding: '10px 16px', textAlign: 'left',
          }}>
            <p style={{ color: '#F2C063', fontSize: 12 }}>{error}</p>
          </div>
        )}

        {saving && (
          <p style={{ color: '#B4A7E5', fontSize: 14, marginTop: 24 }}>Generating financial report...</p>
        )}

        {reportData && !saving && (
          <button
            onClick={() => setStep('report')}
            style={{
              marginTop: 28,
              background: 'rgba(180,167,229,0.15)',
              border: '1px solid rgba(180,167,229,0.4)',
              color: '#B4A7E5',
              padding: '12px 28px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View Financial Report
          </button>
        )}

        <button
          onClick={() => setStep('overview')}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: '#76746E',
            cursor: 'pointer',
            fontSize: 13,
            display: 'block',
            margin: '16px auto 0',
          }}
        >
          Back to overview
        </button>
      </div>
    )
  }

  // ─── Report ──────────────────────────────────────────────────────────────────
  if (step === 'report' && reportData) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => setStep('overview')}
            style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 13 }}
          >
            ← Back to overview
          </button>
        </div>
        <FinancialReport report={reportData} />
      </div>
    )
  }

  return null
}
