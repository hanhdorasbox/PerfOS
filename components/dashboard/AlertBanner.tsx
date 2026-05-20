interface Alert { goalTitle: string; status: string; message: string }

export default function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          padding: '12px 16px', borderRadius: '10px',
          background: a.status === 'critical' ? 'rgba(255,107,107,0.08)' : 'rgba(251,146,60,0.08)',
          border: `1px solid ${a.status === 'critical' ? 'rgba(255,107,107,0.25)' : 'rgba(251,146,60,0.25)'}`,
          display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '14px' }}>{a.status === 'critical' ? '🚨' : '⚠️'}</span>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: a.status === 'critical' ? '#FF6B6B' : '#FB923C' }}>{a.goalTitle}: </span>
            <span style={{ fontSize: '12px', color: '#B8B6B0' }}>{a.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
