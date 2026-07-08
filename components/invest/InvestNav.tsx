'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/invest', label: 'Dashboard' },
  { href: '/invest/portfolio', label: 'Portfolio' },
  { href: '/invest/analyza', label: 'Analýzy' },
  { href: '/invest/alerty', label: 'Alerty' },
  { href: '/invest/nastaveni', label: 'Nastavení' },
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
