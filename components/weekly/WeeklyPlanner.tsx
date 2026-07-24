'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Goal { id: string; title: string; category: string }

interface Task {
  id: string
  title: string
  effort: number
  priority: number
  completed: boolean
  completedAt: string | null
  taskType: string | null
  goal: { id: string; title: string; category: string } | null
  sourceModule: string | null
  sourceId: string | null
  sourceUrl: string | null
}

interface Props {
  userId: string
  weeklyPlanId?: string
  tasks: Task[]
  goals: Goal[]
}

const EFFORT_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Deep work' }
const EFFORT_COLOR: Record<number, string> = { 1: '#6E6E73', 2: '#61adff', 3: '#a085ff' }
const PRIORITY_LABEL: Record<number, string> = { 1: 'Must', 2: 'Should', 3: 'Optional' }
const PRIORITY_COLOR: Record<number, string> = { 1: '#ff8168', 2: '#ffce53', 3: '#6E6E73' }

export default function WeeklyPlanner({ userId, weeklyPlanId, tasks, goals }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [effort, setEffort] = useState(2)
  const [priority, setPriority] = useState(2)
  const [goalId, setGoalId] = useState('')
  const [adding, setAdding] = useState(false)

  const todo   = tasks.filter(t => !t.completed)
  const done   = tasks.filter(t => t.completed)
  const musts  = todo.filter(t => t.priority === 1)
  const should = todo.filter(t => t.priority === 2)
  const optio  = todo.filter(t => t.priority === 3)

  async function toggle(id: string) {
    setToggling(id)
    await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
    startTransition(() => router.refresh())
    setToggling(null)
  }

  async function addTask() {
    if (!title.trim()) return
    setAdding(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(weeklyPlanId ? { weeklyPlanId } : { userId }),
        title: title.trim(),
        effort,
        priority,
        goalId: goalId || null,
      }),
    })
    setTitle('')
    setGoalId('')
    setEffort(2)
    setPriority(2)
    setShowAdd(false)
    setAdding(false)
    startTransition(() => router.refresh())
  }

  const completionRate = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary bar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F5F7' }}>{tasks.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>Done</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#64f0aa' }}>{done.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>Remaining</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F5F7' }}>{todo.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Completion</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: completionRate >= 80 ? '#64f0aa' : completionRate >= 50 ? '#ffce53' : '#F5F5F7' }}>{completionRate}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionRate}%`, background: completionRate >= 80 ? '#64f0aa' : '#ffce53', borderRadius: 4 }} />
          </div>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#a085ff', background: 'rgba(160, 133, 255,0.1)', border: '1px solid rgba(160, 133, 255,0.25)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}
        >
          {showAdd ? '✕ Cancel' : '+ Add Task'}
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em' }}>New Task</div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Task title…"
            autoFocus
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F5F7', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {/* Priority */}
            <div>
              <div style={{ fontSize: 10, color: '#6E6E73', marginBottom: 5 }}>Priority</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 2, 3].map(p => (
                  <button key={p} onClick={() => setPriority(p)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid', background: priority === p ? `${PRIORITY_COLOR[p]}18` : 'transparent', borderColor: priority === p ? `${PRIORITY_COLOR[p]}50` : 'rgba(255,255,255,0.1)', color: priority === p ? PRIORITY_COLOR[p] : '#6E6E73' }}>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Effort */}
            <div>
              <div style={{ fontSize: 10, color: '#6E6E73', marginBottom: 5 }}>Effort</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 2, 3].map(e => (
                  <button key={e} onClick={() => setEffort(e)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid', background: effort === e ? `${EFFORT_COLOR[e]}18` : 'transparent', borderColor: effort === e ? `${EFFORT_COLOR[e]}50` : 'rgba(255,255,255,0.1)', color: effort === e ? EFFORT_COLOR[e] : '#6E6E73' }}>
                    {EFFORT_LABEL[e]}
                  </button>
                ))}
              </div>
            </div>

            {/* Link to goal */}
            {goals.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, color: '#6E6E73', marginBottom: 5 }}>Link to Goal (optional)</div>
                <select
                  value={goalId}
                  onChange={e => setGoalId(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: goalId ? '#F5F5F7' : '#6E6E73', fontSize: 12, outline: 'none' }}
                >
                  <option value="">— none —</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={addTask}
              disabled={adding || !title.trim()}
              style={{ fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 8, background: title.trim() ? 'rgba(160, 133, 255,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${title.trim() ? 'rgba(160, 133, 255,0.35)' : 'rgba(255,255,255,0.08)'}`, color: title.trim() ? '#a085ff' : '#4A4845', cursor: title.trim() ? 'pointer' : 'default' }}
            >
              {adding ? 'Adding…' : 'Add Task'}
            </button>
          </div>
        </div>
      )}

      {/* No tasks yet */}
      {tasks.length === 0 && !showAdd && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 12 }}>No tasks this week yet.</div>
          <div style={{ fontSize: 12, color: '#48484A' }}>Click "+ Add Task" to start planning. A week plan will be created automatically.</div>
        </div>
      )}

      {/* Task groups */}
      {[
        { label: 'Must do', tasks: musts, color: '#ff8168' },
        { label: 'Should do', tasks: should, color: '#ffce53' },
        { label: 'Optional', tasks: optio, color: '#6E6E73' },
      ].map(group => group.tasks.length > 0 && (
        <div key={group.label} className="card">
          <div style={{ fontSize: 10, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            {group.label} · {group.tasks.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {group.tasks.map((t, i) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} toggling={toggling} index={i} />
            ))}
          </div>
        </div>
      ))}

      {/* Completed */}
      {done.length > 0 && (
        <CompletedSection tasks={done} onToggle={toggle} toggling={toggling} />
      )}
    </div>
  )
}

// ── TaskRow ────────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, toggling, index }: { task: Task; onToggle: (id: string) => void; toggling: string | null; index?: number }) {
  const isToggling = toggling === task.id
  const isDone = task.completed

  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
      <button
        onClick={() => onToggle(task.id)}
        disabled={isToggling}
        style={{ width: 22, height: 22, minWidth: 22, borderRadius: isDone ? '50%' : 6, border: isDone ? '2px solid #64f0aa' : '1.5px solid rgba(255,255,255,0.2)', background: isDone ? 'rgba(100, 240, 170,0.2)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: isDone ? '#64f0aa' : '#6E6E73', fontWeight: 700, flexShrink: 0, marginTop: 1 }}
      >
        {isDone ? '✓' : isToggling ? '…' : (index !== undefined ? index + 1 : '')}
      </button>

      <div style={{ flex: 1, minWidth: 0, opacity: isDone ? 0.45 : 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.35 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.goal && (
            <span style={{ fontSize: 11, color: '#6E6E73' }}>→ {task.goal.title}</span>
          )}
          {!isDone && (
            <span style={{ fontSize: 10, color: EFFORT_COLOR[task.effort] ?? '#6E6E73' }}>{EFFORT_LABEL[task.effort]}</span>
          )}
          {task.sourceUrl && !isDone && (
            <Link
              href={task.sourceUrl}
              style={{
                fontSize: 10, color: '#a085ff',
                background: 'rgba(160, 133, 255,0.1)',
                border: '1px solid rgba(160, 133, 255,0.2)',
                borderRadius: 4, padding: '1px 7px',
                textDecoration: 'none', fontWeight: 600,
              }}
            >
              View →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CompletedSection ───────────────────────────────────────────────────────────

function CompletedSection({ tasks, onToggle, toggling }: { tasks: Task[]; onToggle: (id: string) => void; toggling: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
        <span style={{ fontSize: 10, color: '#6E6E73' }}>{open ? '▲' : '▼'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64f0aa', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Completed · {tasks.length}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {tasks.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} toggling={toggling} />)}
        </div>
      )}
    </div>
  )
}
