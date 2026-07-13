'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A subtle “?” marker that reveals a plain-language explanation.
 * Opens on hover (desktop) and on click/tap (mobile), closes on outside
 * click or Escape. Kept dependency-free and inline-styled to match the
 * finance design system.
 */
export default function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          border: '1px solid var(--fin-border-strong, rgba(255,255,255,0.2))',
          background: 'transparent',
          color: 'var(--fin-text-2, #9A9AA3)',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
          padding: 0,
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 60,
            width: 250,
            maxWidth: '70vw',
            padding: '9px 11px',
            borderRadius: 8,
            background: '#141416',
            border: '1px solid var(--fin-border-strong, rgba(255,255,255,0.16))',
            color: 'var(--fin-text-2, #C9C9CF)',
            fontSize: 11.5,
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: 'none',
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
