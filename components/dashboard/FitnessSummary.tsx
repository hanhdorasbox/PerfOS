'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell } from 'lucide-react'

interface FitnessLog { weight: number | null; waist: number | null }

interface Props {
  fitnessLog: FitnessLog | null
  workoutsThisWeek: number
  userId?: string
}

export default function FitnessSummary({ fitnessLog, workoutsThisWeek, userId }: Props) {
  const router = useRouter()
  const [logOpen, setLogOpen] = useState(false)
  const [workoutType, setWorkoutType] = useState('cardio')
  const [duration, setDuration] = useState('30')
  const [logging, setLogging] = useState(false)

  async function logWorkout() {
    if (!userId || !duration || !workoutType) return
    setLogging(true)
    try {
      await fetch('/api/fitness/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: workoutType,
          duration: parseInt(duration),
          notes: null,
        }),
      })
      setLogOpen(false)
      setDuration('30')
      router.refresh()
    } finally {
      setLogging(false)
    }
  }
  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Dumbbell size={12} /> Fitness
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {fitnessLog?.weight && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#EEEEF2' }}>{fitnessLog.weight} kg</div>
            <div style={{ fontSize: '11px', color: '#6E6E76' }}>weight</div>
          </div>
        )}
        {fitnessLog?.waist && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#EEEEF2' }}>{fitnessLog.waist} cm</div>
            <div style={{ fontSize: '11px', color: '#6E6E76' }}>waist</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: workoutsThisWeek >= 3 ? '#64f0aa' : '#ffc648' }}>{workoutsThisWeek}/3</div>
          <div style={{ fontSize: '11px', color: '#6E6E76' }}>workouts/week</div>
        </div>
      </div>

      {!logOpen ? (
        <div style={{ marginTop: '12px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {userId && (
            <button
              onClick={() => setLogOpen(true)}
              style={{
                flex: 1, fontSize: '11px', fontWeight: 600, color: '#0A0A0C',
                background: '#a0f759', border: 'none', borderRadius: 6,
                padding: '6px 12px', cursor: 'pointer',
              }}
            >
              + Log workout
            </button>
          )}
          <Link href="/fitness" style={{ fontSize: '12px', color: '#6E6E76', textDecoration: 'none' }}>Details →</Link>
        </div>
      ) : (
        <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {['cardio', 'strength', 'mobility', 'sports'].map(t => (
              <button
                key={t}
                onClick={() => setWorkoutType(t)}
                style={{
                  fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                  background: workoutType === t ? 'rgba(160, 247, 89,0.2)' : 'transparent',
                  border: workoutType === t ? '1px solid rgba(160, 247, 89,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: workoutType === t ? '#a0f759' : '#6E6E76',
                  fontWeight: workoutType === t ? 600 : 400,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="Minutes"
              min="5"
              step="5"
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#EEEEF2', fontSize: 11, outline: 'none',
              }}
            />
            <span style={{ fontSize: 10, color: '#6E6E76' }}>min</span>
            <button
              onClick={logWorkout}
              disabled={logging}
              style={{
                padding: '6px 14px', borderRadius: 6, background: '#a0f759', border: 'none',
                color: '#0A0A0C', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                opacity: logging ? 0.6 : 1,
              }}
            >
              {logging ? '…' : 'Log'}
            </button>
            <button
              onClick={() => setLogOpen(false)}
              style={{
                padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E76', fontSize: 10, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
