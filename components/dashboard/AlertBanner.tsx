interface Alert { goalTitle: string; status: string; message: string }

// M6: include watch tier (early warning) with a distinct, less alarming style
export default function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 2 }}>
      {alerts.map((a, i) => {
        const isCritical = a.status === 'critical'
        const isAtRisk   = a.status === 'at_risk'
        const isWatch    = a.status === 'watch'
        const color   = isCritical ? '#E8907A' : isAtRisk ? '#E8966A' : '#DDB96A'
        const bgColor = isCritical ? 'rgba(232,144,122,0.07)' : isAtRisk ? 'rgba(232,150,106,0.07)' : 'rgba(221,185,106,0.05)'
        const border  = isCritical ? 'rgba(232,144,122,0.2)' : isAtRisk ? 'rgba(232,150,106,0.2)' : 'rgba(221,185,106,0.15)'
        const icon    = isCritical ? '!' : isAtRisk ? '↑' : '~'
        return (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: isWatch ? '9px 16px' : '12px 16px', borderRadius: 14,
            background: bgColor, border: `1px solid ${border}`,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, color: '#000', fontWeight: 800, lineHeight: 1 }}>{icon}</span>
            </div>
            <div>
              <span style={{ fontSize: isWatch ? 12 : 13, fontWeight: 600, color }}>{a.goalTitle}: </span>
              <span style={{ fontSize: isWatch ? 12 : 13, color: '#9E9EA6' }}>{a.message}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
