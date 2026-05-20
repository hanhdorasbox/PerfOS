export default function CalendarSetupPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const callbackUrl = `${appUrl}/api/calendar/callback`

  return (
    <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FAFAFA', marginBottom: 8 }}>
          Google Calendar — Setup Required
        </h1>
        <p style={{ fontSize: 14, color: '#B8B6B0', lineHeight: 1.6 }}>
          You&apos;re seeing a <strong style={{ color: '#FF6B6B' }}>redirect_uri_mismatch</strong> error because the callback URL isn&apos;t registered in Google Cloud Console.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#F2C063', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          How to fix
        </h2>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 0, listStyle: 'none' }}>
          {[
            'Go to console.cloud.google.com → APIs & Services → Credentials',
            'Click your OAuth 2.0 Client ID (the one used for this app)',
            'Under "Authorized redirect URIs", click Add URI',
            `Add exactly: ${callbackUrl}`,
            'Click Save, then try connecting again',
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#B4A7E5', fontWeight: 700, fontSize: 12, flexShrink: 0, minWidth: 20 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.5 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'monospace', fontSize: 12, color: '#6BE3A4',
        marginBottom: 20,
        wordBreak: 'break-all',
      }}>
        {callbackUrl}
      </div>

      <a href="/" style={{ fontSize: 13, color: '#B4A7E5', textDecoration: 'none' }}>← Back to dashboard</a>
    </main>
  )
}
