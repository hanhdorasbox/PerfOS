'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'
import { Bot, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionResult {
  toolName: string
  result: { success: boolean; message: string; data?: unknown }
}

interface ConfirmationRequired {
  toolName: string
  input: Record<string, unknown>
  preview: string
}

interface UserMsg { role: 'user'; content: string }
interface AssistantMsg {
  role: 'assistant'
  content: string
  actionResults?: ActionResult[]
  confirmationRequired?: ConfirmationRequired
  isError?: boolean
}

type Msg = UserMsg | AssistantMsg

// ─── Inline markdown formatting ───────────────────────────────────────────────

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} style={{ color: '#F5F5F7', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i} style={{ color: '#A1A1A6' }}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, color: '#B8A4FF' }}>{part.slice(1, -1)}</code>
        return part
      })}
    </>
  )
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={`sp-${i}`} style={{ height: 6 }} />)
      i++; continue
    }

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      elements.push(
        <div key={`code-${i}`} style={{ margin: '6px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {lang && <div style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.06)', fontSize: 10, color: '#6E6E73', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{lang}</div>}
          <pre style={{ margin: 0, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', overflowX: 'auto', fontSize: 11, color: '#B8A4FF', lineHeight: 1.6, fontFamily: 'monospace' }}>{codeLines.join('\n')}</pre>
        </div>
      )
      continue
    }

    if (/^>\s?/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { items.push(lines[i].replace(/^>\s?/, '')); i++ }
      elements.push(
        <div key={`bq-${i}`} style={{ margin: '4px 0', paddingLeft: 12, borderLeft: '3px solid rgba(184,164,255,0.4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, ii) => <div key={ii} style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6, fontStyle: 'italic' }}>{inlineFormat(item)}</div>)}
        </div>
      )
      continue
    }

    if (/^###\s+/.test(line)) {
      elements.push(<div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#B8A4FF', marginTop: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{inlineFormat(line.replace(/^###\s+/, ''))}</div>)
      i++; continue
    }

    if (/^##\s+/.test(line)) {
      elements.push(<div key={i} style={{ fontSize: 13, fontWeight: 800, color: '#F5F5F7', marginTop: 10, marginBottom: 4, letterSpacing: '0.04em' }}>{inlineFormat(line.replace(/^##\s+/, ''))}</div>)
      i++; continue
    }

    if (/^#\s+/.test(line)) {
      elements.push(<div key={i} style={{ fontSize: 15, fontWeight: 800, color: '#F5F5F7', marginTop: 12, marginBottom: 6 }}>{inlineFormat(line.replace(/^#\s+/, ''))}</div>)
      i++; continue
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*•]\s+/, '')); i++ }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#A1A1A6', lineHeight: 1.55 }}>
              <span style={{ color: '#B8A4FF', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>•</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++ }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#A1A1A6', lineHeight: 1.55 }}>
              <span style={{ color: '#B8A4FF', flexShrink: 0, fontWeight: 700, minWidth: 18, fontSize: 11 }}>{ii + 1}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    if (/^[-—_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />)
      i++; continue
    }

    elements.push(<div key={i} style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.65 }}>{inlineFormat(line)}</div>)
    i++
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{elements}</div>
}

// ─── Action result card ───────────────────────────────────────────────────────

function ActionResultCard({ results }: { results: ActionResult[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      {results.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          borderRadius: 8, fontSize: 12,
          background: r.result.success ? 'rgba(127,213,170,0.08)' : 'rgba(255,155,135,0.08)',
          border: `1px solid ${r.result.success ? 'rgba(127,213,170,0.2)' : 'rgba(255,155,135,0.2)'}`,
        }}>
          {r.result.success ? <CheckCircle2 size={14} color="#7FD5AA" style={{ flexShrink: 0 }} /> : <XCircle size={14} color="#FF9B87" style={{ flexShrink: 0 }} />}
          <span style={{ color: r.result.success ? '#7FD5AA' : '#FF9B87', fontWeight: 600 }}>{r.result.message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Confirmation card ────────────────────────────────────────────────────────

function ConfirmationCard({
  data,
  onConfirm,
  onDeny,
  loading,
}: {
  data: ConfirmationRequired
  onConfirm: () => void
  onDeny: () => void
  loading: boolean
}) {
  return (
    <div style={{
      marginTop: 10, padding: '12px 14px', borderRadius: 10,
      background: 'rgba(255,155,135,0.07)', border: '1px solid rgba(255,155,135,0.22)',
    }}>
      <div style={{ fontSize: 12, color: '#FF9B87', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertTriangle size={13} /> Confirmation required
      </div>
      <div style={{ fontSize: 13, color: '#A1A1A6', marginBottom: 10 }}>{data.preview}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,155,135,0.15)', border: '1px solid rgba(255,155,135,0.3)', color: '#FF9B87', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Executing…' : 'Confirm'}
        </button>
        <button
          onClick={onDeny}
          disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Tool name → label ────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_module_detail: 'Loading data',
  create_task: 'Creating task',
  complete_task: 'Completing task',
  update_task: 'Updating task',
  delete_task: 'Deleting task',
  move_fitness_session: 'Moving session',
  log_workout: 'Logging workout',
  log_body_measurement: 'Logging measurement',
  log_protein: 'Logging protein',
  update_protein_target: 'Updating target',
  log_goal_progress: 'Logging progress',
  create_learning_task: 'Creating tasks',
  dismiss_pattern: 'Dismissing pattern',
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Am I on track this quarter?',
  "What's most at risk right now?",
  'What should I focus on today?',
  'How is my fitness going this week?',
  'Add a task to review Q2 finances',
  'Log 130g protein for today',
  'Show me my learning roadmap progress',
  'What career gaps should I address?',
]

// ─── Page component ───────────────────────────────────────────────────────────

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: "Connected to your full dashboard — goals, tasks, fitness, nutrition, career, learning, finance, and patterns.\n\nAsk me anything or tell me what to do.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [thinkingLabel, setThinkingLabel] = useState('Thinking…')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build conversation history (only role+content, no metadata)
  const buildHistory = useCallback((msgs: Msg[]) =>
    msgs.map(m => ({ role: m.role, content: m.content })),
    []
  )

  const send = async (overrideInput?: string) => {
    const q = (overrideInput ?? input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg: UserMsg = { role: 'user', content: q }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)
    setThinkingLabel('Thinking…')

    // Cycle through thinking labels
    const labels = ['Thinking…', 'Reading your data…', 'Analyzing…']
    let labelIdx = 0
    const labelInterval = setInterval(() => {
      labelIdx = (labelIdx + 1) % labels.length
      setThinkingLabel(labels[labelIdx])
    }, 1800)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildHistory(nextMessages) }),
      })
      const data = await res.json()

      clearInterval(labelInterval)

      if (data.error) {
        setMessages(m => [...m, { role: 'assistant', content: `Error: ${data.error}`, isError: true }])
      } else {
        setMessages(m => [...m, {
          role: 'assistant',
          content: data.answer ?? '',
          actionResults: data.actionResults,
          confirmationRequired: data.confirmationRequired,
        }])
      }
    } catch {
      clearInterval(labelInterval)
      setMessages(m => [...m, { role: 'assistant', content: 'Connection error. Please try again.', isError: true }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  // Execute confirmed action
  const handleConfirm = async (msgIdx: number, confirmation: ConfirmationRequired) => {
    setConfirmLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], confirm: { toolName: confirmation.toolName, input: confirmation.input } }),
      })
      const data = await res.json()

      // Replace the message's confirmationRequired with actionResult
      setMessages(prev => prev.map((m, i) => {
        if (i !== msgIdx || m.role !== 'assistant') return m
        return {
          ...m,
          confirmationRequired: undefined,
          actionResults: [...(m.actionResults ?? []), { toolName: confirmation.toolName, result: data.actionResult ?? { success: false, message: 'No response' } }],
        }
      }))
    } catch {
      setMessages(prev => prev.map((m, i) => {
        if (i !== msgIdx || m.role !== 'assistant') return m
        return { ...m, confirmationRequired: undefined, actionResults: [...(m.actionResults ?? []), { toolName: confirmation.toolName, result: { success: false, message: 'Request failed' } }] }
      }))
    }
    setConfirmLoading(false)
  }

  // Cancel confirmation
  const handleDeny = (msgIdx: number) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIdx || m.role !== 'assistant') return m
      return {
        ...m,
        confirmationRequired: undefined,
        content: m.content + (m.content ? '\n\n' : '') + 'Action cancelled.',
      }
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(180deg,#FFFFFF,#C7C4BC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
          AI Chief of Staff
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7FD5AA', boxShadow: '0 0 5px rgba(127,213,170,0.6)' }} />
          <span style={{ fontSize: 11, color: '#7FD5AA', fontWeight: 600 }}>Live data</span>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 16px 14px' }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 2 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>

              {m.role === 'assistant' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, fontSize: 13 }}>
                  <Bot size={14} color="#B8A4FF" />
                </div>
              )}

              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                background: m.role === 'user' ? 'rgba(184,164,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(184,164,255,0.22)' : (m as AssistantMsg).isError ? 'rgba(255,155,135,0.2)' : 'rgba(255,255,255,0.07)'}`,
              }}>
                {m.role === 'user' ? (
                  <div style={{ fontSize: 13, color: '#F5F5F7', lineHeight: 1.6 }}>{m.content}</div>
                ) : (
                  <>
                    {m.content && <MarkdownText content={m.content} />}

                    {/* Action results */}
                    {(m as AssistantMsg).actionResults && (m as AssistantMsg).actionResults!.length > 0 && (
                      <ActionResultCard results={(m as AssistantMsg).actionResults!} />
                    )}

                    {/* Confirmation card */}
                    {(m as AssistantMsg).confirmationRequired && (
                      <ConfirmationCard
                        data={(m as AssistantMsg).confirmationRequired!}
                        onConfirm={() => handleConfirm(idx, (m as AssistantMsg).confirmationRequired!)}
                        onDeny={() => handleDeny(idx)}
                        loading={confirmLoading}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} color="#B8A4FF" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%', background: '#B8A4FF',
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      opacity: 0.6,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#6E6E73' }}>{thinkingLabel}</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginTop: 12 }}>

          {/* Suggestion chips */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {SUGGESTIONS.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E73', fontSize: 11, cursor: 'pointer', opacity: loading ? 0.5 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#A1A1A6'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#6E6E73'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything or tell me what to do…"
              disabled={loading}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F5F7', fontSize: 13, outline: 'none', transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(184,164,255,0.35)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(184,164,255,0.14)', border: '1px solid rgba(184,164,255,0.28)', color: '#B8A4FF', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: loading || !input.trim() ? 0.4 : 1, transition: 'all 0.15s' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
