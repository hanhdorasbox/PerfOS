'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  completed: boolean
  effort: number
  goal?: { id: string; title: string; category: string } | null
}

const effortLabel: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Deep work' }

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
    <div style={{ display: 'flex', gap: 6, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
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
            ? (hovered ? 'rgba(107,227,164,0.15)' : 'rgba(107,227,164,0.08)')
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
              ? '2px solid #6BE3A4'
              : `1.5px solid ${hovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
            background: isDone ? 'rgba(107,227,164,0.2)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: isDone ? '#30D158' : '#6E6E73',
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
        {!isDone && task.effort > 0 && (
          <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>{effortLabel[task.effort]}</div>
        )}
      </div>
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

export default function TodayTasks({ tasks, weeklyPlanId }: { tasks: Task[]; weeklyPlanId?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEffort, setNewEffort] = useState(2)
  const [adding, setAdding] = useState(false)

  const todo = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  async function toggleTask(id: string) {
    setToggling(id)
    await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
    startTransition(() => router.refresh())
    setToggling(null)
  }

  async function addTask() {
    if (!newTitle.trim() || !weeklyPlanId) return
    setAdding(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeklyPlanId, title: newTitle.trim(), effort: newEffort }),
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
        {weeklyPlanId && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="btn-motion"
            style={{ fontSize: 11, color: '#BF5AF2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  background: newEffort === e ? 'rgba(180,167,229,0.15)' : 'transparent',
                  borderColor: newEffort === e ? 'rgba(180,167,229,0.4)' : 'rgba(255,255,255,0.08)',
                  color: newEffort === e ? '#BF5AF2' : '#6E6E73',
                }}
              >
                {effortLabel[e]}
              </button>
            ))}
            <button
              onClick={addTask}
              disabled={adding || !newTitle.trim()}
              className="btn-motion"
              style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 12px', borderRadius: 6, background: '#BF5AF2', color: '#050506', border: 'none', cursor: 'pointer', fontWeight: 700, opacity: adding ? 0.6 : 1 }}
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
            background: 'rgba(107,227,164,0.06)',
            border: '1px solid rgba(107,227,164,0.18)',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#30D158', marginBottom: 3 }}>
              ✓ This week complete
            </div>
            <div style={{ fontSize: 11, color: '#6E6E73' }}>
              All {done.length} task{done.length !== 1 ? 's' : ''} done.
            </div>
            <a href="/quarterly" style={{ fontSize: 11, color: '#BF5AF2', textDecoration: 'none', display: 'block', marginTop: 2 }}>
              Plan next week in Quarterly →
            </a>
          </div>
          {/* Collapsed done list */}
          <CollapsedDone tasks={done} onToggle={toggleTask} toggling={toggling} />
        </div>
      )}

      {/* Normal in-progress state */}
      {todo.length > 0 && (
        <>
          {todo.map((t, i) => (
            <TaskRow key={t.id} task={t} onToggle={toggleTask} toggling={toggling} index={i} />
          ))}
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
