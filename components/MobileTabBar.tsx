'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListChecks, CalendarDays, Dumbbell, UtensilsCrossed } from 'lucide-react'

const TABS = [
  { href: '/',          label: 'Today',   icon: LayoutDashboard },
  { href: '/weekly',    label: 'Week',    icon: ListChecks },
  { href: '/quarterly', label: 'Quarter', icon: CalendarDays },
  { href: '/fitness',   label: 'Fitness', icon: Dumbbell },
  { href: '/meals',     label: 'Meals',   icon: UtensilsCrossed },
]

// Bottom tab bar — phones only (shown via .mobile-tabbar CSS media query)
export default function MobileTabBar() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <nav className="mobile-tabbar">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '8px 0 6px',
              textDecoration: 'none',
              color: active ? '#61adff' : '#6E6E76',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={19} strokeWidth={active ? 2 : 1.7} />
            <span style={{ fontSize: 9, fontWeight: active ? 600 : 500, letterSpacing: '0.02em' }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
