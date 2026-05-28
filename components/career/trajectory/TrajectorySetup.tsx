'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TARGET_PATHS = [
  { value: 'senior_analyst', label: 'Senior Analyst' },
  { value: 'strategic_pm', label: 'Strategic PM' },
  { value: 'product', label: 'Product' },
  { value: 'engineering_lead', label: 'Engineering Lead' },
  { value: 'other', label: 'Other' },
]

interface GapItem {
  gapType: string
  title: string
  description: string
  priority: number
}

export default function TrajectorySetup({ userId }: { userId: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [currentRole, setCurrentRole] = useState('')
  const [currentLevel, setCurrentLevel] = useState('')
  const [responsibilities, setResponsibilities] = useState('')
  const [keyStrengths, setKeyStrengths] = useState('')

  const [targetPath, setTargetPath] = useState('senior_analyst')
  const [targetRoleTitle, setTargetRoleTitle] = useState('')
  const [timeHorizon, setTimeHorizon] = useState('12 months')

  const [gaps, setGaps] = useState<GapItem[]>([])
  const [analyzingGaps, setAnalyzingGaps] = useState(false)

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '9px 12px', color: '#F5F5F7', fontSize: 13, width: '100%',
  }

  async function analyzeGaps() {
    setAnalyzingGaps(true)
    setError('')
    try {
      const res = await fetch('/api/career/trajectory/analyze-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          trajectoryData: { currentRole, currentLevel, responsibilities, keyStrengths, targetPath, targetRoleTitle, timeHorizon },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setGaps(data.gaps || [])
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setAnalyzingGaps(false)
    }
  }

  async function saveTrajectory() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/career/trajectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          currentRole,
          currentLevel,
          responsibilities,
          keyStrengths: keyStrengths.split(',').map(s => s.trim()).filter(Boolean),
          targetPath,
          targetRoleTitle,
          timeHorizon,
          gaps,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? '#BF5AF2' : 'rgba(255,255,255,0.1)',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 18 }}>Step 1: Where You Are Now</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Current Role *</label>
              <input value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder="e.g. Data Analyst" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Level / Seniority</label>
              <input value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} placeholder="e.g. Mid-level, L4, 3 years exp" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Key Responsibilities</label>
              <textarea value={responsibilities} onChange={e => setResponsibilities(e.target.value)} placeholder="What do you actually do day-to-day?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Key Strengths (comma-separated)</label>
              <input value={keyStrengths} onChange={e => setKeyStrengths(e.target.value)} placeholder="e.g. SQL, stakeholder management, problem framing" style={inputStyle} />
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!currentRole.trim()}
            style={{
              marginTop: 18, background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
              color: '#BF5AF2', padding: '8px 20px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: !currentRole.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 18 }}>Step 2: Where You Want to Go</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Target Path *</label>
              <select value={targetPath} onChange={e => setTargetPath(e.target.value)} style={inputStyle}>
                {TARGET_PATHS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Target Role Title</label>
              <input value={targetRoleTitle} onChange={e => setTargetRoleTitle(e.target.value)} placeholder="e.g. Head of Analytics, Principal PM" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Time Horizon</label>
              <select value={timeHorizon} onChange={e => setTimeHorizon(e.target.value)} style={inputStyle}>
                <option value="6 months">6 months</option>
                <option value="12 months">12 months</option>
                <option value="18 months">18 months</option>
                <option value="2 years">2 years</option>
                <option value="3 years">3 years</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setStep(1)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
            <button
              onClick={analyzeGaps}
              disabled={analyzingGaps}
              style={{
                background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.4)',
                color: '#BF5AF2', padding: '8px 20px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: analyzingGaps ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzingGaps ? '⏳ Analyzing gaps...' : '🔍 AI Gap Analysis →'}
            </button>
          </div>
          {error && <p style={{ color: '#FF453A', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F7', marginBottom: 4 }}>Step 3: Your Gap Map</h3>
            <p style={{ color: '#A1A1A6', fontSize: 13 }}>
              {gaps.length} gaps identified between your current state and {targetRoleTitle || targetPath}.
            </p>
          </div>

          {gaps.map((gap, i) => (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  background: 'rgba(180,167,229,0.12)', color: '#BF5AF2',
                  border: '1px solid rgba(180,167,229,0.25)',
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                }}>
                  {gap.gapType}
                </span>
                <span style={{ color: gap.priority === 1 ? '#FF453A' : gap.priority === 2 ? '#FFD60A' : '#6E6E73', fontSize: 12, fontWeight: 600 }}>
                  {gap.priority === 1 ? 'High' : gap.priority === 2 ? 'Medium' : 'Low'} priority
                </span>
              </div>
              <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{gap.title}</p>
              {gap.description && <p style={{ color: '#A1A1A6', fontSize: 13 }}>{gap.description}</p>}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
            <button
              onClick={saveTrajectory}
              disabled={loading}
              style={{
                background: 'rgba(107,227,164,0.15)', border: '1px solid rgba(107,227,164,0.4)',
                color: '#30D158', padding: '8px 20px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save Trajectory'}
            </button>
          </div>
          {error && <p style={{ color: '#FF453A', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </div>
  )
}
