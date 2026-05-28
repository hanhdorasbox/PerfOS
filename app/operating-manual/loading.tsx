// Instant skeleton shown by Next.js while the operating manual page loads
export default function OperatingManualLoading() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ height: 28, width: 260, background: 'rgba(255,255,255,0.07)', borderRadius: 6, marginBottom: 8, animation: 'sk 1.4s ease-in-out infinite' }} />
          <div style={{ height: 14, width: 340, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: 120, background: 'rgba(201,184,255,0.1)', borderRadius: 99 }} />
        </div>
        <div style={{ height: 36, width: 160, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
        {/* Left: pattern cards */}
        <div>
          {['Fitness', 'Learning', 'Planning & Execution'].map((domain, di) => (
            <div key={domain} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ height: 12, width: 80, background: 'rgba(255,255,255,0.06)', borderRadius: 3, animation: 'sk 1.4s ease-in-out infinite' }} />
              </div>
              {[0, 1].map(i => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
                  <div style={{ height: 13, width: `${55 + (di + i) * 8}%`, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginBottom: 10 }} />
                  <div style={{ height: 10, width: '85%', background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 6 }} />
                  <div style={{ height: 10, width: '70%', background: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Right: snapshot */}
        <div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px' }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ height: 9, width: '50%', background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 6 }} />
                <div style={{ height: 11, width: '80%', background: 'rgba(255,255,255,0.07)', borderRadius: 3, animation: 'sk 1.4s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes sk { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
