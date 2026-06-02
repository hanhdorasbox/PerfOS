'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  completed: boolean
  effort: number
  priority?: number
  estimatedMinutes?: number | null
  goal?: { id: string; title: string; category: string } | null
}

const effortLabel: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Deep work' }
const effortColor: Record<number, string> = { 1: '#7FD5AA', 2: '#ECC666', 3: '#FF9B87' }
const priorityLabel: Record<number, string> = { 1: 'must', 2: 'should', 3: 'optional' }

function TaskRow({
  task,
  onToggle,
  toggling,
  index,
}: {
  task: Task
  onToggle: (id: string) => void
  toggling: string | null
  index?: number
}) {
  const [hovered, setHovered] = useState(false)
  const isToggling = toggling === task.id
  const isDone = task.completed

  return (
    <div style={{ display: 'flex', gap: 6, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start', borderLeft: `3px solid ${effortColor[task.effort] || 'transparent'}`, paddingLeft: 8 }}>
      {/* Large hit-area button */}
      <button
        onClick={() => onToggle(task.id)}
        disabled={isToggling}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={isDone ? 'Mark incomplete' : 'Mark complete'}
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: isDone
            ? (hovered ? 'rgba(127,213,170,0.15)' : 'rgba(127,213,170,0.08)')
            : (hovered ? 'rgba(255,255,255,0.06)' : 'transparent'),
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.12s',
          marginTop: -6,
          marginLeft: -6,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: isDone ? '50%' : 6,
            border: isDone
              ? '2px solid #7FD5AA'
              : `1.5px solid ${hovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
            background: isDone ? 'rgba(127,213,170,0.2)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: isDone ? '#7FD5AA' : '#6E6E73',
            fontWeight: 700,
            transition: 'all 0.12s',
            pointerEvents: 'none',
          }}
        >
          {isDone ? '✓' : (isToggling ? '…' : (index !== undefined ? index + 1 : ''))}
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0, opacity: isDone ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
        <div style={{
          fontSize: 13,
          color: '#F5F5F7',
          fontWeight: 600,
          textDecoration: isDone ? 'line-through' : 'none',
          lineHeight: 1.35,
        }}>
          {task.title}
        </div>
        {task.goal && (
          <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>→ {task.goal.title}</div>
        )}
        {!isDone && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            {task.effort > 0 && <span style={{ fontSize: 10, color: '#6E6E73' }}>{effortLabel[task.effort]}</span>}
            {task.estimatedMinutes
              ? <span style={{ fontSize: 9, color: '#48484A', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 5px' }}>~{task.estimatedMinutes}m</span>
              : task.effort > 0 && <span style={{ fontSize: 9, color: '#48484A', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 5px' }}>{task.effort === 1 ? '~15m' : task.effort === 2 ? '~25m' : '~45m'}</span>
            }
          </div>
        )}
      </div>
    </div>
  )
}

function CollapsibleTaskGroup({
  label,
  tasks,
  onToggle,
  toggling,
  startIndex,
}: {
  label: string
  tasks: Task[]
  onToggle: (id: string) => void
  toggling: string | null
  startIndex: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}
      >
        <span style={{ fontSize: 10, color: '#6E6E73' }}>{open ? '▲' : '▼'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9E9EA6' }}>
          {label}
        </span>
      </button>
      {open && (
        <div className="expand-enter" style={{ marginTop: 4 }}>
          {tasks.map((t, i) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} toggling={toggling} index={startIndex + i} />
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsedDone({ tasks, onToggle, toggling }: { tasks: Task[]; onToggle: (id: string) => void; toggling: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <span style={{ fontSize: 10, color: '#6E6E73' }}>{open ? '▲' : '▼'}</span>
        <span style={{ fontSize: 11, color: '#6E6E73' }}>
          {open ? 'Hide completed' : `Show ${tasks.length} completed task${tasks.length !== 1 ? 's' : ''}`}
        </span>
      </button>
      {open && (
        <div className="expand-enter" style={{ marginTop: 6 }}>
          {tasks.map(t => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} toggling={toggling} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TodayTasks({
  tasks,
  weeklyPlanId,
  userId,
}: {
  tasks: Task[]
  weeklyPlanId?: string
  userId?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEffort, setNewEffort] = useState(2)
  const [adding, setAdding] = useState(false)

  const todo = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  const mustTasks = todo.filter(t => t.priority === 1)
  const shouldTasks = todo.filter(t => t.priority === 2)
  const optionalTasks = todo.filter(t => t.priority === 3 || !t.priority)

  // Can add a task if we have either a direct planId or a userId to auto-create one
  const canAdd = !!(weeklyPlanId || userId)

  async function toggleTask(id: string) {
    setToggling(id)
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Toggle failed')
      startTransition(() => router.refresh())
    } catch {
      // Silent — state resets on next refresh
    } finally {
      setToggling(null)
    }
  }

  async function addTask() {
    if (!newTitle.trim() || !canAdd) return
    setAdding(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pass weeklyPlanId when known; otherwise pass userId so the API auto-creates the plan
      body: JSON.stringify({
        ...(weeklyPlanId ? { weeklyPlanId } : { userId }),
        title: newTitle.trim(),
        effort: newEffort,
      }),
    })
    setNewTitle('')
    setShowAdd(false)
    setAdding(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
          This Week — Tasks
        </div>
        {canAdd && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="btn-motion"
            style={{ fontSize: 11, color: '#B8A4FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Task title…"
            autoFocus
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#F5F5F7', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[1, 2, 3].map(e => (
              <button
                key={e}
                onClick={() => setNewEffort(e)}
                style={{
                  fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid',
                  cursor: 'pointer',
                  background: newEffort === e ? 'rgba(184,164,255,0.15)' : 'transparent',
                  borderColor: newEffort === e ? 'rgba(184,164,255,0.4)' : 'rgba(255,255,255,0.08)',
                  color: newEffort === e ? '#B8A4FF' : '#6E6E73',
                }}
              >
                {effortLabel[e]}
              </button>
            ))}
            <button
              onClick={addTask}
              disabled={adding || !newTitle.trim()}
              className="btn-motion"
              style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 12px', borderRadius: 6, background: '#B8A4FF', color: '#050506', border: 'none', cursor: 'pointer', fontWeight: 700, opacity: adding ? 0.6 : 1 }}
            >
              {adding ? '…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {!tasks.length && (
        <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic' }}>No tasks this week. Add one above.</div>
      )}

      {/* When ALL tasks are done, show week-complete state */}
      {todo.length === 0 && done.length > 0 && (
        <div>
          <div className="animate-fade-in" style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(127,213,170,0.06)',
            border: '1px solid rgba(127,213,170,0.18)',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7FD5AA', marginBottom: 3 }}>
              ✓ This week complete
            </div>
            <div style={{ fontSize: 11, color: '#6E6E73' }}>
              All {done.length} task{done.length !== 1 ? 's' : ''} done.
            </div>
            <a href="/weekly" style={{ fontSize: 11, color: '#B8A4FF', textDecoration: 'none', display: 'block', marginTop: 2 }}>
              Plan next week →
            </a>
          </div>
          {/* Collapsed done list */}
          <CollapsedDone tasks={done} onToggle={toggleTask} toggling={toggling} />
        </div>
      )}

      {/* Normal in-progress state — grouped by priority */}
      {todo.length > 0 && (
        <>
          {/* Must tasks — always visible */}
          {mustTasks.length > 0 && (
            <div>
              {mustTasks.length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#FF9B87', marginBottom: 6, marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Must Do ({mustTasks.length})
                </div>
              )}
              {mustTasks.map((t, i) => (
                <TaskRow key={t.id} task={t} onToggle={toggleTask} toggling={toggling} index={i} />
              ))}
            </div>
          )}

          {/* Should tasks — collapsible */}
          {shouldTasks.length > 0 && (
            <CollapsibleTaskGroup
              label={`Should Do (${shouldTasks.length})`}
              tasks={shouldTasks}
              onToggle={toggleTask}
              toggling={toggling}
              startIndex={mustTasks.length}
            />
          )}

          {/* Optional tasks — collapsible */}
          {optionalTasks.length > 0 && (
            <CollapsibleTaskGroup
              label={`Optional (${optionalTasks.length})`}
              tasks={optionalTasks}
              onToggle={toggleTask}
              toggling={toggling}
              startIndex={mustTasks.length + shouldTasks.length}
            />
          )}

          {done.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {done.map(t => (
                <TaskRow key={t.id} task={t} onToggle={toggleTask} toggling={toggling} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
