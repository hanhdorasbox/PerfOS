'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
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
      { href: '/fitness/strategy', label: '🏋️ Fitness Strategy', separator: true },
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
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {primaryLinks.map(link => (
        <Link key={link.href} href={link.href} style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
          background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent',
          textDecoration: 'none', whiteSpace: 'nowrap',
          transition: 'color 0.12s ease, background 0.12s ease',
        }}>{link.label}</Link>
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
                padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: groupActive || isOpen ? '#FAFAFA' : '#B8B6B0',
                background: groupActive || isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.12s ease, background 0.12s ease',
              }}
            >{group.emoji} {group.label} ▾</button>

            <div className={`dropdown-panel${isOpen ? ' open' : ''}`}>
              {group.links.map(link => (
                <div key={link.href}>
                  {link.separator && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '5px 8px 4px' }} />}
                  <Link href={link.href} onClick={() => setOpenGroup(null)} style={{
                    display: 'block', padding: '7px 12px', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
                    background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent',
                    transition: 'color 0.1s ease, background 0.1s ease',
                  }}
                    onMouseEnter={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLAnchorElement).style.color = '#FAFAFA' } }}
                    onMouseLeave={e => { if (!isActive(link.href)) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#B8B6B0' } }}
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

// ─── Mobile nav (hamburger + drawer) ─────────────────────────────────────────

function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Menu"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer', color: '#FAFAFA', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, top: 52,
            background: 'rgba(0,0,0,0.6)', zIndex: 90,
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 52, right: 0, bottom: 0,
        width: '80vw', maxWidth: 320,
        background: 'rgba(8,8,10,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 95,
        overflowY: 'auto',
        padding: '16px 12px 40px',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Primary links */}
        <div style={{ marginBottom: 8 }}>
          {primaryLinks.map(link => (
            <Link key={link.href} href={link.href} style={{
              display: 'block', padding: '11px 14px', borderRadius: 10, marginBottom: 2,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
              background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}>{link.label}</Link>
          ))}
        </div>

        {/* Groups */}
        {menuGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#76746E',
              padding: '4px 14px 8px',
            }}>
              {group.emoji} {group.label}
            </div>
            {group.links.map(link => (
              <div key={link.href}>
                {link.separator && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 14px 6px' }} />}
                <Link href={link.href} style={{
                  display: 'block', padding: '10px 14px', borderRadius: 10, marginBottom: 2,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  color: isActive(link.href) ? '#FAFAFA' : '#B8B6B0',
                  background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}>{link.label}</Link>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function NavLinks() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileNav /> : <DesktopNav />
}
