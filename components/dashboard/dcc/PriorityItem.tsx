'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PRIORITY_COLOR, PRIORITY_LABEL, EFFORT_LABEL, SOURCE_LINK, effortTimeLabel } from './helpers'
import type { WeeklyTask, BriefingPriority, MicroStep } from './types'


export default function PriorityItem({
  task,
  briefItem,
  onToggle,
  toggling,
  celebTaskId,
  onBreakSteps,
  loadingSteps,
  expandedSteps,
  completedSteps,
  onToggleStep,
}: {
  task: WeeklyTask
  briefItem?: BriefingPriority
  onToggle: (id: string) => void
  toggling: string | null
  celebTaskId: string | null
  onBreakSteps: (id: string) => void
  loadingSteps: string | null
  expandedSteps: Record<string, MicroStep[]>
  completedSteps: Record<string, Set<number>>
  onToggleStep: (taskId: string, index: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const priority = briefItem?.priority ?? (task.priority === 1 ? 'must' : task.priority === 3 ? 'optional' : 'should')
  const color = PRIORITY_COLOR[priority]
  const isToggling = toggling === task.id
  const isCelebrating = celebTaskId === task.id
  const timeLabel = task.estimatedMinutes ? `~${task.estimatedMinutes}m` : effortTimeLabel(task.effort)
  const steps = expandedSteps[task.id]
  const isLoadingThisStep = loadingSteps === task.id
  const doneStepCount = completedSteps[task.id]?.size ?? 0
  const totalStepCount = steps?.length ?? 0
  const hasStepProgress = totalStepCount > 0 && doneStepCount > 0

  return (
    <div>
      <style>{`
        @keyframes celebFlash {
          0% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderBottom: steps ? 'none' : '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
        <button
          onClick={() => onToggle(task.id)}
          disabled={isToggling}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title="Mark complete"
          style={{
            width: 36, height: 36, minWidth: 36, borderRadius: 10, flexShrink: 0,
            background: isCelebrating ? `${color}20` : hovered ? `${color}10` : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'background 0.12s', marginTop: -6, marginLeft: -6,
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: `2px solid ${isCelebrating || hasStepProgress ? color : hovered ? color : `${color}66`}`,
            background: hasStepProgress ? `${color}15` : isToggling ? `${color}20` : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.12s, background 0.12s', pointerEvents: 'none',
          }}>
            {isToggling && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 0.8s ease-in-out infinite' }} />
            )}
            {isCelebrating && !isToggling && (
              <span style={{ fontSize: 10, color, fontWeight: 900, animation: 'celebFlash 1.2s ease-out forwards' }}>✓</span>
            )}
            {hasStepProgress && !isToggling && !isCelebrating && (
              <span style={{ fontSize: 7, color, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {doneStepCount}/{totalStepCount}
              </span>
            )}
          </div>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: '#EEEEF2', fontWeight: 600, lineHeight: 1.4,
            position: 'relative',
          }}>
            {task.title}
            {isCelebrating && (
              <span style={{
                marginLeft: 8, fontSize: 11, color: '#7FD5AA', fontWeight: 700,
                animation: 'fadeOut 1.2s ease-out forwards',
                position: 'absolute',
              }}>
                +1 ✓
              </span>
            )}
          </div>
          {task.goal && (
            <div style={{ fontSize: 11, color: '#6E6E76', marginTop: 2 }}>→ {task.goal.title}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            {task.effort > 0 && (
              <span style={{ fontSize: 10, color: '#6E6E76' }}>{EFFORT_LABEL[task.effort]}</span>
            )}
            {timeLabel && (
              <span style={{
                fontSize: 9, color: '#52525A', background: 'rgba(255,255,255,0.05)',
                padding: '1px 5px', borderRadius: 4, fontWeight: 600,
              }}>
                {timeLabel}
              </span>
            )}
            {briefItem?.whyToday && (
              <span style={{ fontSize: 11, color: '#6E6E76', fontStyle: 'italic', lineHeight: 1.4 }}>{briefItem.whyToday}</span>
            )}
            {task.sourceModule && SOURCE_LINK[task.sourceModule] && (
              <Link
                href={SOURCE_LINK[task.sourceModule].href}
                style={{ fontSize: 10, color: '#6E6E7680', textDecoration: 'none', letterSpacing: '0.02em' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#B8A4FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6E6E7680')}
              >
                {SOURCE_LINK[task.sourceModule].label}
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
          <button
            onClick={() => onBreakSteps(task.id)}
            disabled={isLoadingThisStep}
            title="Break into micro-steps"
            style={{
              fontSize: 9, color: '#52525A', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
              padding: '2px 6px', cursor: 'pointer',
              opacity: isLoadingThisStep ? 0.5 : 1,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#B8A4FF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525A')}
          >
            {isLoadingThisStep ? '…' : '⋯ Steps'}
          </button>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color }}>
            {PRIORITY_LABEL[priority]}
          </span>
        </div>
      </div>

      {/* Micro-steps expansion */}
      {steps && (
        <div className="expand-enter" style={{
          marginLeft: 30, marginBottom: 8, padding: '8px 10px',
          background: 'rgba(184,164,255,0.05)', border: '1px solid rgba(184,164,255,0.15)',
          borderRadius: 8, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
        }}>
          {steps.map((step, i) => {
            const done = completedSteps[task.id]?.has(i) ?? false
            return (
              <div
                key={i}
                onClick={() => onToggleStep(task.id, i)}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 2px', cursor: 'pointer' }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${done ? '#7FD5AA' : 'rgba(255,255,255,0.18)'}`,
                  background: done ? 'rgba(127,213,170,0.18)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  {done && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7FD5AA' }} />}
                </div>
                <span style={{
                  fontSize: 11, flex: 1, lineHeight: 1.45,
                  color: done ? '#3E3E44' : '#9E9EA6',
                  textDecoration: done ? 'line-through' : 'none',
                  transition: 'all 0.15s ease',
                }}>{step.title}</span>
                <span style={{ fontSize: 9, color: '#52525A', flexShrink: 0, opacity: done ? 0.35 : 1 }}>~{step.estimatedMinutes}m</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
