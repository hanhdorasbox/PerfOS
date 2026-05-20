'use client'
import { useState, useRef, useEffect } from 'react'
import React from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

function inlineFormat(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: '#FAFAFA', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} style={{ color: '#B8B6B0' }}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, color: '#B4A7E5' }}>{part.slice(1, -1)}</code>
        }
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

    // Blank line → spacing
    if (line.trim() === '') {
      elements.push(<div key={`sp-${i}`} style={{ height: 6 }} />)
      i++
      continue
    }

    // Fenced code block: ```[lang]
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <div key={`code-${i}`} style={{ margin: '6px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {lang && (
            <div style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.06)', fontSize: 10, color: '#76746E', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {lang}
            </div>
          )}
          <pre style={{ margin: 0, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', overflowX: 'auto', fontSize: 11, color: '#B4A7E5', lineHeight: 1.6, fontFamily: 'monospace' }}>
            {codeLines.join('\n')}
          </pre>
        </div>
      )
      continue
    }

    // Blockquote: >
    if (/^>\s?/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        items.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      elements.push(
        <div key={`bq-${i}`} style={{ margin: '4px 0', paddingLeft: 12, borderLeft: '3px solid rgba(180,167,229,0.4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, ii) => (
            <div key={ii} style={{ fontSize: 13, color: '#76746E', lineHeight: 1.6, fontStyle: 'italic' }}>{inlineFormat(item)}</div>
          ))}
        </div>
      )
      continue
    }

    // Heading 3: ###
    if (/^###\s+/.test(line)) {
      elements.push(
        <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#B4A7E5', marginTop: 8, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {inlineFormat(line.replace(/^###\s+/, ''))}
        </div>
      )
      i++; continue
    }

    // Heading 2: ##
    if (/^##\s+/.test(line)) {
      elements.push(
        <div key={i} style={{ fontSize: 13, fontWeight: 800, color: '#FAFAFA', marginTop: 10, marginBottom: 4, letterSpacing: '0.04em' }}>
          {inlineFormat(line.replace(/^##\s+/, ''))}
        </div>
      )
      i++; continue
    }

    // Heading 1: #
    if (/^#\s+/.test(line)) {
      elements.push(
        <div key={i} style={{ fontSize: 15, fontWeight: 800, color: '#FAFAFA', marginTop: 12, marginBottom: 6 }}>
          {inlineFormat(line.replace(/^#\s+/, ''))}
        </div>
      )
      i++; continue
    }

    // Unordered list item: -, *, or •
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#B8B6B0', lineHeight: 1.55 }}>
              <span style={{ color: '#B4A7E5', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>•</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list item: 1., 2., etc.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#B8B6B0', lineHeight: 1.55 }}>
              <span style={{ color: '#B4A7E5', flexShrink: 0, fontWeight: 700, minWidth: 18, fontSize: 11 }}>{ii + 1}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Horizontal rule
    if (/^[-—_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />)
      i++; continue
    }

    // Regular paragraph line
    elements.push(
      <div key={i} style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.65 }}>
        {inlineFormat(line)}
      </div>
    )
    i++
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{elements}</div>
}

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "I have access to your full performance dashboard. Ask me anything about your goals, priorities, forecasts, or what you should focus on right now." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const q = input.trim(); if (!q) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.answer || data.error || 'Error' }])
    } catch { setMessages(m => [...m, { role: 'assistant', content: 'Connection error.' }]) }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(180deg,#FFFFFF,#C7C4BC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '20px' }}>
        🤖 AI Chief of Staff
      </h1>
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>🤖</span>}
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? 'rgba(180,167,229,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(180,167,229,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                {m.role === 'user'
                  ? <div style={{ fontSize: '13px', color: '#FAFAFA', lineHeight: 1.6 }}>{m.content}</div>
                  : <MarkdownText content={m.content} />
                }
              </div>
            </div>
          ))}
          {loading && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>🤖</span><div style={{ fontSize: '13px', color: '#76746E' }}>Thinking…</div></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px', marginTop: '14px', display: 'flex', gap: '8px' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Am I on track this quarter? What should I focus on today?" disabled={loading}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '13px', outline: 'none' }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '10px 18px', borderRadius: '10px', background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.3)', color: '#B4A7E5', fontWeight: 700, cursor: 'pointer', fontSize: '13px', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['Am I on track this quarter?', "What's most at risk?", 'What should I focus on today?', 'Is my quarter overloaded?'].map(q => (
            <button key={q} onClick={() => { setInput(q); }} style={{ padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#76746E', fontSize: '11px', cursor: 'pointer' }}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
