'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { primaryLinks, menuGroups, type NavLink } from '@/components/NavLinks'
import { Search, CornerDownLeft } from 'lucide-react'

interface PaletteItem extends NavLink {
  group: string
}

const ALL_ITEMS: PaletteItem[] = [
  ...primaryLinks.map(l => ({ ...l, group: 'Navigate' })),
  ...menuGroups.flatMap(g => g.links.map(l => ({ ...l, group: g.label }))),
]

function scoreItem(item: PaletteItem, q: string): number {
  const label = item.label.toLowerCase()
  if (label.startsWith(q)) return 0
  const idx = label.indexOf(q)
  if (idx >= 0) return 1 + idx
  if (item.href.toLowerCase().includes(q)) return 100
  if (item.group.toLowerCase().includes(q)) return 200
  return -1
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_ITEMS
    return ALL_ITEMS
      .map(item => ({ item, score: scoreItem(item, q) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map(r => r.item)
  }, [query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  const go = useCallback((href: string) => {
    close()
    router.push(href)
  }, [router, close])

  // Global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
  }, [open])

  // Keep active row in view
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div
      className="overlay-enter"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(5,5,8,0.55)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: 'min(18vh, 160px)',
      }}
    >
      <div
        className="overlay-content-enter"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(92vw, 560px)',
          background: 'rgba(28,28,32,0.96)',
          backdropFilter: 'blur(28px) saturate(1.6)', WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={15} color="#6E6E76" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].href) }
            }}
            placeholder="Go to…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: '#EEEEF2', caretColor: '#80BDFF',
            }}
          />
          <kbd style={{ fontSize: 10, color: '#52525A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 6px' }}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 340, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: 12, color: '#6E6E76', textAlign: 'center' }}>
              No matches
            </div>
          ) : results.map((item, i) => {
            const Icon = item.icon
            const isActive = i === active
            return (
              <button
                key={item.href + item.label}
                data-idx={i}
                onClick={() => go(item.href)}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(128,189,255,0.10)' : 'transparent',
                  textAlign: 'left', transition: 'background 0.08s',
                }}
              >
                {Icon && <Icon size={14} strokeWidth={1.7} color={isActive ? '#80BDFF' : '#6E6E76'} style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: 13, color: isActive ? '#EEEEF2' : '#9E9EA6', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 10, color: '#52525A' }}>{item.group}</span>
                {isActive && <CornerDownLeft size={11} color="#52525A" strokeWidth={2} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
