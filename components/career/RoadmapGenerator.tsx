'use client'
import { useState } from 'react'
import Spinner from '@/components/ui/Spinner'

interface Phase {
  name: string
  duration: string
  focus: string
  milestones: string[]
  weeklyTasks: string[]
  resources: string[]
}

interface Roadmap {
  title: string
  summary: string
  phases: Phase[]
}

export default function RoadmapGenerator() {
  const [goal, setGoal] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [error, setError] = useState('')
  const [savedRoadmaps, setSavedRoadmaps] = useState<{ goal: string; roadmap: Roadmap; createdAt: string }[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('perfos_roadmaps') || '[]') } catch { return [] }
  })

  async function generate() {
    if (!goal.trim() || !timeframe.trim()) return
    setLoading(true)
    setError('')
    setRoadmap(null)
    try {
      const res = await fetch('/api/career/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim(), timeframe: timeframe.trim(), context: context.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRoadmap(data)
      const newEntry = { goal: goal.trim(), roadmap: data, createdAt: new Date().toISOString() }
      const updated = [newEntry, ...savedRoadmaps].slice(0, 10)
      setSavedRoadmaps(updated)
      localStorage.setItem('perfos_roadmaps', JSON.stringify(updated))
    } catch (e: any) {
      setError(e.message || 'Failed to generate roadmap')
    } finally {
      setLoading(false)
    }
  }

  const phaseColors = ['#B4A7E5', '#6BE3A4', '#F2C063', '#60A5FA', '#FB923C']

  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: 16 }}>
        Goal Roadmap Generator
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="What do you want to achieve? e.g. Become a Senior Data Analyst"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FAFAFA', fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
            placeholder="Timeframe e.g. 12 months, Q3 2026"
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FAFAFA', fontSize: 13, outline: 'none' }}
          />
          <button
            onClick={generate}
            disabled={loading || !goal.trim() || !timeframe.trim()}
            className="btn-motion"
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: loading ? 'rgba(180,167,229,0.1)' : 'rgba(180,167,229,0.15)',
              border: '1px solid rgba(180,167,229,0.3)', color: '#B4A7E5',
              cursor: loading || !goal.trim() || !timeframe.trim() ? 'not-allowed' : 'pointer',
              opacity: !goal.trim() || !timeframe.trim() ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '⟳ Generating…' : '✦ Generate Roadmap'}
          </button>
        </div>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Optional context: current level, constraints, relevant background…"
          rows={2}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#B8B6B0', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8, color: '#FF6B6B', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#76746E', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Spinner size={20} color="#B4A7E5" />
          Generating roadmap…
        </div>
      )}

      {roadmap && <RoadmapView roadmap={roadmap} phaseColors={phaseColors} />}

      {savedRoadmaps.length > 0 && !roadmap && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '11px', color: '#76746E', marginBottom: 10 }}>Recent roadmaps:</div>
          {savedRoadmaps.slice(0, 5).map((r, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setRoadmap(r.roadmap)}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#FAFAFA' }}>{r.goal}</div>
                <div style={{ fontSize: 11, color: '#76746E', marginTop: 2 }}>
                  {r.roadmap.phases?.length || 0} phases · {new Date(r.createdAt).toLocaleDateString('cs-CZ')}
                </div>
              </div>
              <button
                onClick={() => {
                  const updated = savedRoadmaps.filter((_, idx) => idx !== i)
                  setSavedRoadmaps(updated)
                  localStorage.setItem('perfos_roadmaps', JSON.stringify(updated))
                }}
                style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 13, padding: '0 4px', flexShrink: 0 }}
                title="Delete"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RoadmapView({ roadmap, phaseColors }: { roadmap: Roadmap; phaseColors: string[] }) {
  const [openPhase, setOpenPhase] = useState<number | null>(0)

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#FAFAFA', marginBottom: 6 }}>{roadmap.title}</div>
        <div style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{roadmap.summary}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {roadmap.phases?.map((p, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: `${phaseColors[i % phaseColors.length]}18`, color: phaseColors[i % phaseColors.length], border: `1px solid ${phaseColors[i % phaseColors.length]}30` }}>
            Phase {i + 1}: {p.name}
          </div>
        ))}
      </div>

      {roadmap.phases?.map((phase, i) => (
        <div key={i} style={{ marginBottom: 10, borderLeft: `3px solid ${phaseColors[i % phaseColors.length]}50`, paddingLeft: 14 }}>
          <button
            onClick={() => setOpenPhase(openPhase === i ? null : i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '8px 0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: phaseColors[i % phaseColors.length] }}>Phase {i + 1}: {phase.name}</span>
                <span style={{ fontSize: 11, color: '#76746E', marginLeft: 10 }}>{phase.duration}</span>
              </div>
              <span style={{ color: '#76746E', fontSize: 12 }}>{openPhase === i ? '▲' : '▼'}</span>
            </div>
            <div style={{ fontSize: 12, color: '#B8B6B0', marginTop: 3 }}>{phase.focus}</div>
          </button>

          {openPhase === i && (
            <div style={{ paddingBottom: 12 }}>
              {phase.milestones?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: 6 }}>Milestones</div>
                  {phase.milestones.map((m, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, color: '#FAFAFA' }}>
                      <span style={{ color: phaseColors[i % phaseColors.length], flexShrink: 0 }}>◆</span>
                      {m}
                    </div>
                  ))}
                </div>
              )}

              {phase.weeklyTasks?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: 6 }}>Weekly Tasks</div>
                  {phase.weeklyTasks.map((t, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, color: '#B8B6B0' }}>
                      <span style={{ color: '#76746E', flexShrink: 0 }}>→</span>
                      {t}
                    </div>
                  ))}
                </div>
              )}

              {phase.resources?.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: 6 }}>Resources</div>
                  {phase.resources.map((r, j) => (
                    <div key={j} style={{ fontSize: 12, color: '#76746E', marginBottom: 3 }}>📖 {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
