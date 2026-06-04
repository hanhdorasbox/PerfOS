export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>
      {/* Page title skeleton */}
      <div className="shimmer-loading" style={{ height: 28, width: 160, borderRadius: 8 }} />

      {/* Primary content row */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card shimmer-loading" style={{ height: 148, padding: 0, border: 'none' }} />
        <div className="card shimmer-loading" style={{ height: 148, padding: 0, border: 'none' }} />
      </div>

      {/* Wide card */}
      <div className="card shimmer-loading" style={{ height: 220, padding: 0, border: 'none' }} />

      {/* Bottom row */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card shimmer-loading" style={{ height: 100, padding: 0, border: 'none' }} />
        <div className="card shimmer-loading" style={{ height: 100, padding: 0, border: 'none' }} />
        <div className="card shimmer-loading" style={{ height: 100, padding: 0, border: 'none' }} />
      </div>
    </div>
  )
}
