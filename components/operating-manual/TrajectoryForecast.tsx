'use client'
import { useState } from 'react'

interface DomainForecast {
  name: string
  outlook: string
  risk: 'high' | 'medium' | 'low' | 'stable'
}

interface TrajectoryData {
  domains: DomainForecast[]
  overallTrajectory: string
  highLeverageInterventions: string[]
}

interface Props {
  userId: string
  hasPatterns: boolean
}

const RISK_META: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: 'HIGH RISK', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)' },
  medium: { label: 'AT RISK',   color: '#F2C063', bg: 'rgba(242,192,99,0.1)' },
  low:    { label: 'ON TRACK',  color: '#6BE3A4', bg: 'rgba(107,227,164,0.1)' },
  stable: { label: 'STABLE',    color: '#60A5FA', bg: 'rgba(96,165,250,0.1)'  },
}

const DOMAIN_ICON: Record<string, string> = {
  Fitness: '💪',
  Learning: '🧠',
  Meals: '🥗',
  Portfolio: '📁',
  Planning: '🗓️',
}

export default function TrajectoryForecast({ userId, hasPatterns }: Props) {
  const [data, setData] = useState<TrajectoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/operating-manual/trajectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate forecast')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      marginTop: 40,
      background: 'linear-gradient(135deg, rgba(180,167,229,0.04), rgba(255,255,255,0.01))',
      border: '1px solid rgba(180,167,229,0.12)',
      borderRadius: 20,
      padding: '28px 32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: data ? 28 : 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 22, background: 'linear-gradient(180deg,#B4A7E5,#60A5FA)', borderRadius: 2 }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.02em' }}>
              Trajectory Forecast
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#76746E', marginLeft: 13 }}>
            If current patterns continue — where are you headed?
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading || !hasPatterns}
          title={!hasPatterns ? 'Run pattern analysis first' : 'Generate trajectory forecast'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: (loading || !hasPatterns) ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(180,167,229,0.08)' : 'rgba(180,167,229,0.12)',
            border: '1px solid rgba(180,167,229,0.25)',
            color: '#B4A7E5',
            opacity: !hasPatterns ? 0.5 : 1,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              Forecasting…
            </>
          ) : data ? (
            <>↻ Regenerate</>
          ) : (
            <>🔮 Generate Forecast</>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {!hasPatterns && !data && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#76746E', fontSize: 13, fontStyle: 'italic' }}>
          Run a pattern analysis first to enable trajectory forecasting.
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 10, color: '#FF6B6B', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Domain skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 110, borderRadius: 14, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.6s ease-in-out infinite' }} />
            ))}
          </div>
          <div style={{ height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* A. Domain-by-domain outlook */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: 14 }}>
              Domain Outlook
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(data.domains.length, 4)}, 1fr)`,
              gap: 14,
            }}>
              {data.domains.map((domain, i) => {
                const risk = RISK_META[domain.risk] ?? RISK_META.medium
                const icon = DOMAIN_ICON[domain.name] ?? '📊'
                return (
                  <div
                    key={i}
                    style={{
                      padding: '16px 18px',
                      background: risk.bg,
                      border: `1px solid ${risk.color}25`,
                      borderRadius: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FAFAFA' }}>
                        {icon} {domain.name}
                      </div>
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                        color: risk.color, flexShrink: 0, marginLeft: 6,
                        background: `${risk.color}18`,
                        border: `1px solid ${risk.color}30`,
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                        {risk.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#B8B6B0', lineHeight: 1.6 }}>
                      {domain.outlook}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* B. Overall trajectory */}
          <div style={{
            padding: '18px 22px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: 10 }}>
              Overall Trajectory
            </div>
            <p style={{ fontSize: 14, color: '#FAFAFA', lineHeight: 1.7, fontWeight: 500 }}>
              {data.overallTrajectory}
            </p>
          </div>

          {/* C. High-leverage interventions */}
          {data.highLeverageInterventions?.length > 0 && (
            <div style={{
              padding: '18px 22px',
              background: 'rgba(107,227,164,0.03)',
              border: '1px solid rgba(107,227,164,0.12)',
              borderRadius: 14,
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6BE3A4', marginBottom: 12 }}>
                What Changes the Forecast Most
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.highLeverageInterventions.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: '#6BE3A4',
                      background: 'rgba(107,227,164,0.12)',
                      border: '1px solid rgba(107,227,164,0.2)',
                      borderRadius: 5,
                      padding: '2px 7px',
                      flexShrink: 0,
                      marginTop: 1,
                      letterSpacing: '0.06em',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
