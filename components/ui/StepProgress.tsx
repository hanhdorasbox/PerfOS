'use client'
import Spinner from './Spinner'

export interface ProgressStep {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

interface StepProgressProps {
  steps: ProgressStep[]
  compact?: boolean
}

/**
 * Multi-step progress indicator.
 * Used for long async flows (PDF upload, fitness strategy generation, etc.)
 */
export default function StepProgress({ steps, compact = false }: StepProgressProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {steps.map((step, i) => {
        const isDone    = step.status === 'done'
        const isActive  = step.status === 'active'
        const isError   = step.status === 'error'
        const isPending = step.status === 'pending'

        return (
          <div
            key={i}
            className={isActive ? 'animate-fade-in' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: isPending ? 0.3 : 1,
              transition: 'opacity 0.35s ease',
            }}
          >
            {/* Status dot */}
            <div style={{
              width: compact ? 18 : 20,
              height: compact ? 18 : 20,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDone   ? 'rgba(100, 240, 170,0.18)'
                        : isActive ? 'rgba(160, 133, 255,0.12)'
                        : isError  ? 'rgba(255, 129, 104,0.12)'
                        : 'rgba(255,255,255,0.04)',
              border: `1px solid ${
                isDone   ? 'rgba(100, 240, 170,0.4)'
              : isActive ? 'rgba(160, 133, 255,0.35)'
              : isError  ? 'rgba(255, 129, 104,0.4)'
              : 'rgba(255,255,255,0.08)'}`,
              transition: 'background 0.3s ease, border-color 0.3s ease',
            }}>
              {isDone    && <span className="check-pop" style={{ fontSize: 10, color: '#64f0aa', lineHeight: 1 }}>✓</span>}
              {isActive  && <Spinner size={compact ? 10 : 12} color="#a085ff" strokeWidth={1.5} />}
              {isError   && <span style={{ fontSize: 10, color: '#ff8168', lineHeight: 1 }}>✕</span>}
              {isPending && <span style={{ fontSize: 9, color: '#6E6E73', fontWeight: 700, lineHeight: 1 }}>{i + 1}</span>}
            </div>

            {/* Label */}
            <span style={{
              fontSize: compact ? 12 : 13,
              fontWeight: isActive ? 600 : 400,
              color: isDone   ? '#64f0aa'
                   : isActive ? '#a085ff'
                   : isError  ? '#ff8168'
                   : '#6E6E73',
              transition: 'color 0.3s ease',
              lineHeight: 1.3,
            }}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
