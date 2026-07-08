import type { Metadata } from 'next'
import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google'
import InvestNav from '@/components/invest/InvestNav'
import './finance-os.css'

const serif = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fin-serif',
})

const sans = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fin-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fin-mono',
})

export const metadata: Metadata = {
  title: 'Finance OS',
  description: 'Osobní finanční dashboard — portfolio, valuace, alerty',
}

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`finance-os ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20 }}>
        <h1 className="fin-h1" style={{ margin: 0 }}>
          Finance OS
        </h1>
        <span className="fin-subtle" style={{ fontSize: 12 }}>
          portfolio · valuace · alerty
        </span>
      </header>
      <InvestNav />
      {children}
    </div>
  )
}
