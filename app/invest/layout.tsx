import type { Metadata } from 'next'
import InvestNav from '@/components/invest/InvestNav'
import './finance-os.css'

export const metadata: Metadata = {
  title: 'Finance OS',
  description: 'Osobní finanční dashboard — portfolio, valuace, alerty',
}

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finance-os">
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
