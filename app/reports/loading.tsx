// Instant skeleton shown by Next.js while the reports page server component loads
export default function ReportsLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 28, width: 220, background: 'rgba(255,255,255,0.07)', borderRadius: 6, marginBottom: 8, animation: 'sk 1.4s ease-in-out infinite' }} />
        <div style={{ height: 14, width: 300, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
      </div>

      {/* Week progress */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 20 }} />

      {/* Status card */}
      <div style={{ background: 'rgba(128,189,255,0.06)', border: '1px solid rgba(128,189,255,0.12)', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ height: 14, width: 80, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 14, animation: 'sk 1.4s ease-in-out infinite' }} />
        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{ height: 11, width: `${65 + j * 12}%`, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 7 }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <div style={{ height: 9, width: '55%', background: 'rgba(255,255,255,0.06)', borderRadius: 3, margin: '0 auto 10px' }} />
            <div style={{ height: 22, width: '45%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, margin: '0 auto', animation: 'sk 1.4s ease-in-out infinite' }} />
          </div>
        ))}
      </div>

      {/* Goal cards */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ height: 9, width: 100, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 16 }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, marginBottom: 8, borderLeft: '3px solid rgba(255,255,255,0.06)' }}>
            <div style={{ height: 12, width: `${40 + i * 20}%`, background: 'rgba(255,255,255,0.07)', borderRadius: 3, marginBottom: 10 }} />
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
          </div>
        ))}
      </div>

      <style>{`@keyframes sk { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
