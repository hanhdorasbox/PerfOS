'use client'
import type { WeeklyTask } from './types'
import type { WorkSchedule } from '@/lib/work-schedule'
import { minToTimeStr } from '@/lib/work-schedule'

const DAY_END = 22 * 60
const MIN_GAP = 15

interface Interval { start: number; end: number }

function taskEstimate(t: WeeklyTask): number {
  return t.estimatedMinutes ?? (t.effort === 1 ? 15 : t.effort === 2 ? 25 : 45)
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end)
    else merged.push({ ...iv })
  }
  return merged
}

export interface GapSuggestion {
  gapStart: number
  gapEnd: number
  task: WeeklyTask
}

// Free windows between now and 22:00 (minus work hours and calendar events),
// each matched with the highest-priority task that fits.
export function computeGapSuggestions(
  tasks: WeeklyTask[],
  events: Array<{ start: Date; end: Date }>,
  workSchedule: WorkSchedule,
): GapSuggestion[] {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (nowMin >= DAY_END) return []

  const busy: Interval[] = []
  const work = workSchedule[now.getDay()]
  if (work) busy.push({ start: work.start, end: work.end })
  for (const e of events) {
    busy.push({
      start: e.start.getHours() * 60 + e.start.getMinutes(),
      end: e.end.getHours() * 60 + e.end.getMinutes(),
    })
  }

  // Free gaps in [now, DAY_END]
  const merged = mergeIntervals(busy.filter(b => b.end > nowMin).map(b => ({
    start: Math.max(b.start, nowMin), end: Math.min(b.end, DAY_END),
  })).filter(b => b.start < b.end))

  const gaps: Interval[] = []
  let cursor = nowMin
  for (const b of merged) {
    if (b.start - cursor >= MIN_GAP) gaps.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (DAY_END - cursor >= MIN_GAP) gaps.push({ start: cursor, end: DAY_END })

  // Highest-priority first, big tasks first within the same priority
  const pool = [...tasks].sort((a, b) =>
    (a.priority ?? 2) - (b.priority ?? 2) || taskEstimate(b) - taskEstimate(a)
  )

  const suggestions: GapSuggestion[] = []
  const used = new Set<string>()
  for (const gap of gaps) {
    const len = gap.end - gap.start
    const task = pool.find(t => !used.has(t.id) && taskEstimate(t) <= len)
    if (task) {
      used.add(task.id)
      suggestions.push({ gapStart: gap.start, gapEnd: gap.end, task })
    }
    if (suggestions.length >= 3) break
  }
  return suggestions
}

export default function GapSuggestions({
  suggestions,
  onFocusTask,
}: {
  suggestions: GapSuggestion[]
  onFocusTask: (task: WeeklyTask) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div style={{
      marginBottom: 12, padding: '10px 12px', borderRadius: 12,
      background: 'rgba(97, 173, 255,0.04)', border: '1px solid rgba(97, 173, 255,0.12)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#61adff', marginBottom: 8, opacity: 0.85 }}>
        Fits your day
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map(({ gapStart, gapEnd, task }) => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#61adff', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 88 }}>
              {minToTimeStr(gapStart)} – {minToTimeStr(gapEnd)}
            </span>
            <span style={{
              fontSize: 12, color: '#9E9EA6', flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {task.title}
            </span>
            <span style={{ fontSize: 10, color: '#52525A', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              ~{taskEstimate(task)}m
            </span>
            <button
              onClick={() => onFocusTask(task)}
              title="Start Focus Mode with this task"
              style={{
                fontSize: 10, fontWeight: 600, color: '#a085ff', flexShrink: 0,
                background: 'rgba(160, 133, 255,0.08)', border: '1px solid rgba(160, 133, 255,0.2)',
                borderRadius: 6, padding: '2px 9px', cursor: 'pointer',
              }}
            >
              Focus
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
