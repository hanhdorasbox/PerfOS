'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, Delete } from 'lucide-react'

const MAX_LEN = 12

export default function LockScreen({ next }: { next: string }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  // Render through a portal to <body> so the fixed overlay escapes the
  // animated `.page-enter` container (a transform/will-change ancestor traps
  // position:fixed), letting it truly cover the whole screen incl. the nav.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const submit = useCallback(
    async (value: string) => {
      if (busy || value.length === 0) return
      setBusy(true)
      setError(false)
      try {
        const res = await fetch('/api/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: value }),
        })
        if (res.ok) {
          // Full navigation so the freshly set cookie is used for the RSC load
          window.location.replace(next || '/')
          return
        }
        setError(true)
        setPin('')
        if (navigator.vibrate) navigator.vibrate(60)
      } catch {
        setError(true)
        setPin('')
      } finally {
        setBusy(false)
      }
    },
    [busy, next],
  )

  const press = useCallback(
    (digit: string) => {
      setError(false)
      setPin((prev) => (prev.length >= MAX_LEN ? prev : prev + digit))
    },
    [],
  )

  const backspace = useCallback(() => {
    setError(false)
    setPin((prev) => prev.slice(0, -1))
  }, [])

  // Hardware keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Enter') void submit(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, backspace, submit, pin])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  if (!mounted) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: '#0A0A0B',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        paddingBottom: 'env(safe-area-inset-bottom)',
        color: '#ECECEF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(201,169,97,0.35)',
            background: 'rgba(201,169,97,0.08)',
            color: '#C9A961',
          }}
        >
          <Lock size={22} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 15, color: '#9A9AA3' }}>
          {error ? 'Wrong PIN — try again' : 'Enter passcode'}
        </div>

        {/* PIN dots */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            height: 14,
            transform: error ? 'translateX(0)' : undefined,
            animation: error ? 'ph-shake 0.4s' : undefined,
          }}
        >
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: i < pin.length ? '#C9A961' : 'transparent',
                border: '1px solid ' + (i < pin.length ? '#C9A961' : 'rgba(255,255,255,0.18)'),
                transition: 'background 0.1s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: 16 }}>
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} style={keyStyle}>
            {k}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} style={keyStyle}>
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          aria-label="Delete"
          style={{ ...keyStyle, border: 'none', background: 'transparent', color: '#9A9AA3' }}
        >
          <Delete size={22} strokeWidth={1.7} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void submit(pin)}
        disabled={busy || pin.length === 0}
        style={{
          padding: '11px 30px',
          borderRadius: 12,
          border: '1px solid rgba(201,169,97,0.35)',
          background: pin.length > 0 ? 'rgba(201,169,97,0.12)' : 'transparent',
          color: '#C9A961',
          fontSize: 15,
          fontWeight: 600,
          opacity: pin.length === 0 || busy ? 0.4 : 1,
          cursor: pin.length === 0 || busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>

      <style>{`
        @keyframes ph-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>,
    document.body,
  )
}

const keyStyle: React.CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: '#ECECEF',
  fontSize: 28,
  fontWeight: 400,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  fontVariantNumeric: 'tabular-nums',
}
