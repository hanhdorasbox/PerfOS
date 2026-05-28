'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/lib/useIsMobile'

const primaryLinks = [
  { href: '/',         label: '📊 Dashboard' },
  { href: '/quarterly', label: '📅 Quarterly' },
  { href: '/reports',   label: '📋 Reports' },
  { href: '/ai',        label: '🤖 AI Advisor' },
]

interface NavLink { href: string; label: string; separator?: boolean }

const menuGroups: Array<{ label: string; emoji: string; links: NavLink[] }> = [
  {
    label: 'Career', emoji: '🚀',
    links: [
      { href: '/career',            label: '📈 Career Capital' },
      { href: '/learning',          label: '🧠 Learning' },
      { href: '/ideas',             label: '💡 Ideas' },
      { href: '/career/trajectory', label: '🎯 Trajectory', separator: true },
    ],
  },
  {
    label: 'Body', emoji: '💪',
    links: [
      { href: '/fitness',          label: '💪 Fitness' },
      { href: '/meals',            label: '🥗 Meal Planning' },
      { href: '/fitness/strategy', label: '🏋️ Fitness Strategy' },
      { href: '/habits',           label: '🚫 Habit Breaker', separator: true },
    ],
  },
  {
    label: 'System', emoji: '⚙️',
    links: [
      { href: '/anti-drift',       label: '🧭 Anti-Drift' },
      { href: '/operating-manual', label: '⚙️ Operating Manual' },
      { href: '/finance',          label: '💰 Finance' },
    ],
  },
]

const allMobileLinks = [
  ...primaryLinks,
  ...menuGroups.flatMap(g => g.links),
]

// ─── Desktop nav ─────────────────────────────────────────────────────────────

function DesktopNav() {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setOpenGroup(null) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!openGroup) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openGroup])

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenGroup(null), 220)
  }, [])
  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {primaryLinks.map(link => (
        <Link key={link.href} href={link.href} style={{
          padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          color: isActive(link.href) ? '#F5F5F7' : '#A1A1A6',
          background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
          textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.01em',
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
          onMouseEnter={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.color = '#F5F5F7'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)' } }}
          onMouseLeave={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.color = '#A1A1A6'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' } }}
        >{link.label}</Link>
      ))}

      {menuGroups.map(group => {
        const groupActive = group.links.some(l => isActive(l.href))
        const isOpen = openGroup === group.label
        return (
          <div key={group.label} className="nav-group" onMouseLeave={scheduleClose} onMouseEnter={cancelClose}>
            <button
              onClick={() => { cancelClose(); setOpenGroup(prev => prev === group.label ? null : group.label) }}
              onMouseEnter={() => { cancelClose(); if (openGroup && openGroup !== group.label) setOpenGroup(group.label) }}
              style={{
                padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                color: groupActive || isOpen ? '#F5F5F7' : '#A1A1A6',
                background: groupActive || isOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.01em',
                transition: 'color 0.15s ease, background 0.15s ease',
              }}
            >{group.emoji} {group.label} ▾</button>

            <div className={`dropdown-panel${isOpen ? ' open' : ''}`}>
              {group.links.map(link => (
                <div key={link.href}>
                  {link.separator && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '5px 6px' }} />}
                  <Link href={link.href} onClick={() => setOpenGroup(null)} style={{
                    display: 'block', padding: '8px 12px', borderRadius: 10,
                    fontSize: 13, fontWeight: 500, textDecoration: 'none', letterSpacing: '-0.01em',
                    color: isActive(link.href) ? '#F5F5F7' : '#A1A1A6',
                    background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transition: 'color 0.12s ease, background 0.12s ease',
                  }}
                    onMouseEnter={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLAnchorElement).style.color = '#F5F5F7' } }}
                    onMouseLeave={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#A1A1A6' } }}
                  >{link.label}</Link>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mobile nav (hamburger + portal drawer) ──────────────────────────────────

function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  const drawer = mounted ? createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, top: 52,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 990,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 56, right: 0, bottom: 0,
        width: '80vw', maxWidth: 300,
        background: 'rgba(22, 22, 24, 0.97)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        borderLeft: '1px solid rgba(255,255,255,0.09)',
        zIndex: 991,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '20px 12px 60px',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}>
        {/* Primary links */}
        <div style={{ marginBottom: 16 }}>
          {primaryLinks.map(link => (
            <Link key={link.href} href={link.href} style={{
              display: 'block', padding: '11px 14px', borderRadius: 12, marginBottom: 2,
              fontSize: 15, fontWeight: 500, textDecoration: 'none', letterSpacing: '-0.01em',
              color: isActive(link.href) ? '#F5F5F7' : '#A1A1A6',
              background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}>{link.label}</Link>
          ))}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 2px 16px' }} />

        {/* Groups */}
        {menuGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#6E6E73',
              padding: '0 14px 8px',
            }}>
              {group.emoji} {group.label}
            </div>
            {group.links.map(link => (
              <div key={link.href}>
                {link.separator && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 14px 6px' }} />}
                <Link href={link.href} style={{
                  display: 'block', padding: '10px 14px', borderRadius: 12, marginBottom: 2,
                  fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: '-0.01em',
                  color: isActive(link.href) ? '#F5F5F7' : '#A1A1A6',
                  background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}>{link.label}</Link>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Menu"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer', color: '#F5F5F7', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {open ? '✕' : '☰'}
      </button>
      {drawer}
    </>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function NavLinks() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileNav /> : <DesktopNav />
}
