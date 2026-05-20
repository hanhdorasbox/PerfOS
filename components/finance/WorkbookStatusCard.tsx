'use client'

interface WorkbookData {
  id: string
  fileName: string
  connectedAt: string
  lastImportAt: string | null
  lastImportMonth: string | null
}

interface Props {
  workbook: WorkbookData | null
  ruleCount: number
  onConnect: () => void
}

export default function WorkbookStatusCard({ workbook, ruleCount, onConnect }: Props) {
  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!workbook) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px' }}>
        <div>
          <p style={{ color: '#FF6B6B', fontSize: 13, fontWeight: 600 }}>No workbook connected</p>
          <p style={{ color: '#76746E', fontSize: 12, marginTop: 4 }}>Connect the Finance Tracker Excel workbook to begin</p>
        </div>
        <button
          onClick={onConnect}
          className="btn-motion"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(180,167,229,0.15)',
            border: '1px solid rgba(180,167,229,0.4)',
            color: '#B4A7E5', padding: '10px 22px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            minWidth: 160, flexShrink: 0,
          }}
        >
          Connect Workbook
        </button>
      </div>
    )
  }

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
            📊
          </div>
          <div>
            <p style={{ color: '#FAFAFA', fontWeight: 600, fontSize: 15 }}>{workbook.fileName}</p>
            <p style={{ color: '#76746E', fontSize: 12, marginTop: 2 }}>Connected {formatDate(workbook.connectedAt)}</p>
          </div>
        </div>
        <div style={{
          background: 'rgba(107,227,164,0.1)',
          border: '1px solid rgba(107,227,164,0.25)',
          color: '#6BE3A4',
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}>
          CONNECTED
        </div>
      </div>

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
