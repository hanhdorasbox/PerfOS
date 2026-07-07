'use client'
import { useState, useEffect } from 'react'
import SideCard from '@/components/ui/SideCard'
import { parseSafeJson } from './helpers'
import type { FitnessStrategy } from './types'


export default function FitnessSnapshot({ strategy, userId, onWorkoutLogged }: { strategy: FitnessStrategy | null; userId?: string; onWorkoutLogged?: () => void }) {
  const [loggingSession, setLoggingSession] = useState<string | null>(null)
  const [loggedSessions, setLoggedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    fetch(`/api/fitness/workout?userId=${userId}`)
      .then(r => r.json())
      .then((types: string[]) => setLoggedSessions(new Set(types)))
      .catch(() => {})
  }, [userId])

  const today = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[today.getDay()]

  const schedule = parseSafeJson<Array<{ day: string; sessions: string[] }>>(strategy?.weeklySchedule)
  const todayEntry = schedule?.find(d => d.day.toLowerCase() === todayName.toLowerCase())
  const todaySessions = todayEntry?.sessions ?? []

  const nutritionDir = parseSafeJson<{ proteinTarget?: number; targetProtein?: number }>(strategy?.nutritionDir)
  const targetProtein = nutritionDir?.proteinTarget ?? nutritionDir?.targetProtein

  async function logSession(sessionName: string) {
    if (!userId) return
    setLoggingSession(sessionName)
    try {
      // Extract duration from session name if present, e.g. "Stairmaster Cardio (20–25 min)" → 22
      const durationMatch = sessionName.match(/(\d+)(?:[–-](\d+))?\s*min/i)
      const duration = durationMatch
        ? durationMatch[2]
          ? Math.round((parseInt(durationMatch[1]) + parseInt(durationMatch[2])) / 2)
          : parseInt(durationMatch[1])
        : 30
      await fetch('/api/fitness/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: sessionName, duration, notes: null }),
      })
      setLoggedSessions(prev => new Set([...prev, sessionName]))
      onWorkoutLogged?.()
    } finally {
      setLoggingSession(null)
    }
  }

  return (
    <SideCard label="Today's Fitness" action={{ href: '/fitness', label: 'Details →' }}>
      {todaySessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {todaySessions.map((s, i) => {
            const done = loggedSessions.has(s)
            const isLogging = loggingSession === s
            return (
              <button
                key={i}
                onClick={() => !done && logSession(s)}
                disabled={isLogging || done}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', cursor: done ? 'default' : 'pointer',
                  padding: '3px 0', textAlign: 'left', width: '100%',
                  opacity: isLogging ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${done ? '#7FD5AA' : 'rgba(255,255,255,0.2)'}`,
                  background: done ? 'rgba(127,213,170,0.2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="#7FD5AA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {isLogging && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A3D977', animation: 'pulse 0.8s ease-in-out infinite' }} />}
                </div>
                <span style={{
                  fontSize: 12, color: done ? '#6E6E76' : '#EEEEF2', fontWeight: 500,
                  textDecoration: done ? 'line-through' : 'none', transition: 'all 0.2s',
                }}>{s}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E76' }}>Rest day</div>
      )}

    </SideCard>
  )
}
