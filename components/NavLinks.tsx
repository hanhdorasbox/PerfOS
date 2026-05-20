'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'

const primaryLinks = [
  { href: '/', label: '📊 Dashboard' },
  { href: '/quarterly', label: '📅 Quarterly' },
  { href: '/reports', label: '📋 Reports' },
  { href: '/ai', label: '🤖 AI Advisor' },
]

interface NavLink { href: string; label: string; separator?: boolean }

const menuGroups: Array<{ label: string; emoji: string; links: NavLink[] }> = [
  {
    label: 'Career',
    emoji: '🚀',
    links: [
      { href: '/career',            label: '📈 Career Capital' },
      { href: '/learning',          label: '🧠 Learning' },
      { href: '/ideas',             label: '💡 Ideas' },
      { href: '/career/trajectory', label: '🎯 Trajectory', separator: true },
    ],
  },
  {
    label: 'Body',
    emoji: '💪',
    links: [
      { href: '/fitness',          label: '💪 Fitness' },
      { href: '/meals',            label: '🥗 Meal Planning' },
      { href: '/fitness/strategy', label: '🏋️ Fitness Strategy', separator: true },
    ],
  },
  {
    label: 'System',
    emoji: '⚙️',
    links: [
      { href: '/anti-drift',        label: '🧭 Anti-Drift' },
      { href: '/operating-manual',  label: '⚙️ Operating Manual' },
      { href: '/finance',           label: '💰 Finance' },
    ],
  },
]

export default function NavLinks() {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Close on route change ────────────────────────────────────────────────
  useEffect(() => { setOpenGroup(null) }, [pathname])

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!openGroup) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openGroup])

  // ── Hover-delay helpers ──────────────────────────────────────────────────
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenGroup(null), 220)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const handleTriggerClick = (label: string) => {
    cancelClose()
    setOpenGroup(prev => (prev === label ? null : label))
  }

  // If a group is already open and cursor enters a different trigger, switch immediately
  const handleTriggerEnter = (label: string) => {
    cancelClose()
    if (openGroup && openGroup !== label) setOpenGroup(label)
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

      {/* Primary flat links */}
      {primaryLinks.map(link => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
            background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent',
            textDecoration: 'none', whiteSpace: 'nowrap',
            transition: 'color 0.12s ease, background 0.12s ease',
          }}
        >
          {link.label}
        </Link>
      ))}

      {/* Dropdown groups */}
      {menuGroups.map(group => {
        const groupActive = group.links.some(l => isActive(l.href))
        const isOpen = openGroup === group.label

        return (
          <div
            key={group.label}
            className="nav-group"
            onMouseLeave={scheduleClose}
            onMouseEnter={cancelClose}
          >
            <button
              onClick={() => handleTriggerClick(group.label)}
              onMouseEnter={() => handleTriggerEnter(group.label)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: groupActive || isOpen ? '#FAFAFA' : '#B8B6B0',
                background: groupActive || isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.12s ease, background 0.12s ease',
              }}
            >
              {group.emoji} {group.label} ▾
            </button>

            {/* Always rendered — CSS transition handles show/hide */}
            <div className={`dropdown-panel${isOpen ? ' open' : ''}`}>
              {group.links.map(link => (
                <div key={link.href}>
                  {link.separator && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '5px 8px 4px' }} />
                  )}
                  <Link
                    href={link.href}
                    onClick={() => setOpenGroup(null)}
                    style={{
                      display: 'block', padding: '7px 12px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, textDecoration: 'none',
                      color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
                      background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent',
                      transition: 'color 0.1s ease, background 0.1s ease',
                    }}
                    onMouseEnter={e => {
                      if (!isActive(link.href)) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = '#FAFAFA'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive(link.href)) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = '#B8B6B0'
                      }
                    }}
                  >
                    {link.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
