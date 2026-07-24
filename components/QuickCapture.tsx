'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  userId: string
}

export default function QuickCapture({ userId }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'task' | 'idea'>('task')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'must' | 'should' | 'optional'>('should')
  const [effort, setEffort] = useState<'low' | 'medium' | 'deep'>('medium')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40)
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleSubmit() {
    if (!title.trim() || loading) return
    setLoading(true)
    try {
      if (mode === 'task') {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            title: title.trim(),
            priority,
            effort,
            sourceModule: 'manual',
            sourceType: 'manual_task',
            createdBy: 'user',
          }),
        })
      } else {
        await fetch('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title: title.trim() }),
        })
      }
      setSaved(true)
      setTitle('')
      setTimeout(() => { setSaved(false); setOpen(false) }, 900)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Rychlé zachycení (⌘J)"
        aria-label="Rychlé zachycení"
        className="quick-capture-root"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 200,
          width: 50, height: 50, borderRadius: '50%',
          background: '#a085ff', border: 'none', cursor: 'pointer',
          fontSize: 26, fontWeight: 300, color: '#0A0A0C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(160, 133, 255,0.45)',
          lineHeight: 1, transition: 'transform 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(160, 133, 255,0.6)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(160, 133, 255,0.45)'
        }}
      >
        +
      </button>

      {open && (
        <div
          onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 201,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }}
        >
          <div style={{
            background: '#141416', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: 22, width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
              {(['task', 'idea'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                    border: mode === m ? '1px solid rgba(160, 133, 255,0.45)' : '1px solid rgba(255,255,255,0.07)',
                    background: mode === m ? 'rgba(160, 133, 255,0.12)' : 'transparent',
                    color: mode === m ? '#a085ff' : '#6E6E73',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                  }}>
                  {m === 'task' ? '✓ Task' : '💡 Idea'}
                </button>
              ))}
              <span style={{ fontSize: 10, color: '#3A3A3C', flexShrink: 0, marginLeft: 4 }}>⌘K</span>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              placeholder={mode === 'task' ? 'What needs to be done...' : 'Idea or thought...'}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#F5F5F7', fontSize: 14, outline: 'none',
              }}
            />

            {/* Task options */}
            {mode === 'task' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#52525A', marginBottom: 4, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Priority</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(['must', 'should', 'optional'] as const).map(p => (
                      <button key={p} onClick={() => setPriority(p)}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                          border: priority === p ? '1px solid rgba(255, 129, 104,0.45)' : '1px solid rgba(255,255,255,0.06)',
                          background: priority === p ? 'rgba(255, 129, 104,0.12)' : 'transparent',
                          color: priority === p ? '#ff8168' : '#52525A',
                        }}>
                        {p === 'must' ? 'Must' : p === 'should' ? 'Should' : 'Opt'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#52525A', marginBottom: 4, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Effort</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(['low', 'medium', 'deep'] as const).map(e => (
                      <button key={e} onClick={() => setEffort(e)}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                          border: effort === e ? '1px solid rgba(160, 133, 255,0.45)' : '1px solid rgba(255,255,255,0.06)',
                          background: effort === e ? 'rgba(160, 133, 255,0.12)' : 'transparent',
                          color: effort === e ? '#a085ff' : '#52525A',
                        }}>
                        {e === 'low' ? '~15m' : e === 'medium' ? '~25m' : '~45m'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !title.trim()}
              style={{
                width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 9,
                background: saved ? '#64f0aa' : title.trim() ? '#a085ff' : 'rgba(160, 133, 255,0.25)',
                border: 'none', cursor: !title.trim() ? 'default' : 'pointer',
                color: '#0A0A0C', fontSize: 13, fontWeight: 700,
                transition: 'background 0.2s',
              }}
            >
              {saved ? '✓ Saved!' : loading ? '…' : mode === 'task' ? 'Add task  ↵' : 'Save idea  ↵'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
