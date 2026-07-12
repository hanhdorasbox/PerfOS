'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/invest', label: 'Dashboard' },
  { href: '/invest/portfolio', label: 'Portfolio' },
  { href: '/invest/analysis', label: 'Analysis' },
  { href: '/invest/alerts', label: 'Alerts' },
  { href: '/invest/settings', label: 'Settings' },
]

export default function InvestNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/invest' ? pathname === '/invest' : pathname.startsWith(href)

  return (
    <nav className="fin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className="fin-tab" data-active={isActive(tab.href)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
