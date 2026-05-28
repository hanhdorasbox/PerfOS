interface Alert { goalTitle: string; status: string; message: string }

export default function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 2 }}>
      {alerts.map((a, i) => {
        const isCritical = a.status === 'critical'
        const color  = isCritical ? '#FF453A' : '#FF9F0A'
        const bgColor = isCritical ? 'rgba(255,69,58,0.07)' : 'rgba(255,159,10,0.07)'
        const border  = isCritical ? 'rgba(255,69,58,0.2)'  : 'rgba(255,159,10,0.2)'
        return (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '12px 16px', borderRadius: 14,
            background: bgColor, border: `1px solid ${border}`,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 11, color: '#000', fontWeight: 800, lineHeight: 1 }}>
                {isCritical ? '!' : '↑'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color }}>{a.goalTitle}: </span>
              <span style={{ fontSize: 13, color: '#A1A1A6' }}>{a.message}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
