'use client'
import { useState, useEffect, useRef } from 'react'
import type { WeeklyTask } from './types'


export default function FocusModeOverlay({
  task,
  nextTaskTitle,
  onDone,
  onExit,
}: {
  task: WeeklyTask
  nextTaskTitle?: string | null
  onDone: () => void
  onExit: () => void
}) {
  // Timer matches the task's own estimate; effort-based fallback, then 25 min
  const estimateMin = task.estimatedMinutes
    ?? (task.effort === 1 ? 15 : task.effort === 2 ? 25 : task.effort === 3 ? 45 : 25)
  const DURATION = estimateMin * 60
  const [secondsLeft, setSecondsLeft] = useState(DURATION)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')

  const timeLabel = task.estimatedMinutes
    ? `~${task.estimatedMinutes} min`
    : task.effort === 1 ? '~15 min' : task.effort === 2 ? '~25 min' : task.effort === 3 ? '~45 min' : null

  return (
    <div className="overlay-enter" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10,10,12,0.96)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute', top: 24, right: 24,
          fontSize: 11, color: '#52525A', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer',
        }}
      >
        Exit Focus
      </button>

      {/* Center content */}
      <div className="overlay-content-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#52525A' }}>
          Focus Mode
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, color: '#EEEEF2', lineHeight: 1.35 }}>
          {task.title}
        </div>

        {timeLabel && (
          <span style={{
            fontSize: 12, color: '#9E9EA6', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            padding: '4px 12px',
          }}>
            {timeLabel}
          </span>
        )}

        {/* Timer */}
        <div style={{
          fontSize: 64, fontWeight: 800, color: secondsLeft === 0 ? '#64f0aa' : '#EEEEF2',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          {mins}:{secs}
        </div>

        {/* Pause/Resume */}
        <button
          onClick={() => setRunning(r => !r)}
          style={{
            fontSize: 13, color: '#9E9EA6', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
            padding: '8px 20px', cursor: 'pointer',
          }}
        >
          {running ? 'Pause' : 'Resume'}
        </button>

        {/* Done button */}
        <button
          onClick={onDone}
          style={{
            fontSize: 15, fontWeight: 700, color: '#0A0A0C',
            background: '#64f0aa', border: 'none', borderRadius: 10,
            padding: '12px 32px', cursor: 'pointer',
          }}
        >
          ✓ Done{nextTaskTitle ? ' — next task' : ''}
        </button>

        {/* Up next hint */}
        {nextTaskTitle && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, maxWidth: 420 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#44444A', flexShrink: 0 }}>
              Up next
            </span>
            <span style={{
              fontSize: 12, color: '#6E6E76', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {nextTaskTitle}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
